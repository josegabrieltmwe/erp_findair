import { ref, computed, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shipment/stores/toast.store";
import {
  labelsService,
  type CourierLabelItem,
} from "@shipment/services/labels.service";
import type { LabelSelection } from "@shipment/labels/labelPackages";
import {
  courierCombinedPdfUrl,
  courierCombinedZipUrl,
} from "@shipment/labels/labelUrls";
import { printPdfFromUrl } from "@shipment/labels/printPdf";

/** Acciones de fichero de etiqueta que el BFF sirve como binario (bff/config/routes.bff.yaml). */
const LABEL_FILE_ACTIONS = [
  "get_label_file",
  "get_label_auxiliar_file",
] as const;

/**
 * URL de un fichero de etiqueta a traves del BFF. get_label_courier_shipment devuelve la URL absoluta del API
 * (https://sandbox.api.../erp/tmwe_json/get_label_file?shipment_id=..&package_number=..); desde el ERP el navegador
 * no lleva sesion ni token a ese host y el API responde 401 (1001084298, 2026-11-07). Se reescribe a
 * `${base}/get_label_file?...` conservando la query. Otras URLs se devuelven tal cual.
 */
export function bffLabelFileUrl(url: string, base: string): string {
  if (!url) return "";
  let parsed: URL;
  try {
    parsed = new URL(url, "http://local.invalid");
  } catch {
    return url;
  }
  const segment = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
  const action = parsed.searchParams.get("action") ?? segment;
  if (!(LABEL_FILE_ACTIONS as readonly string[]).includes(action)) return url;
  parsed.searchParams.delete("action");
  const query = parsed.searchParams.toString();
  return `${base.replace(/\/+$/, "")}/${action}${query ? `?${query}` : ""}`;
}

/** URL absoluta con el origen de la pagina (sin window, tal cual). Las ya absolutas no cambian. */
export function absoluteUrl(url: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!url || !base) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/**
 * Courier-label generation/preview/print/download, extracted from ServizioCard.
 *
 * The state and helpers here were shared across three surfaces of the card: the
 * one-click print button in the AWB row, the "AWB generated" success dialog, and
 * the full courier-labels dialog. Consolidating them into one composable removes
 * the tangle and lets each dialog become presentational. Behaviour is unchanged.
 *
 * @param shipmentId reactive getter for the current shipment id
 * @param awb        reactive getter for the current AWB (for warnings + filenames)
 */
export function useCourierLabels(shipmentId: () => number, awb: () => string) {
  const { t } = useI18n();
  const toasts = useToastStore();

  // Full courier-labels dialog state.
  const dialogOpen = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const list = ref<CourierLabelItem[]>([]);
  /** True while the one-click print flow is fetching the labels. */
  const printing = ref(false);

  // "AWB generated" success dialog state.
  const successOpen = ref(false);
  const successLoading = ref(false);
  const successLabels = ref<CourierLabelItem[]>([]);
  const generatedTracking = ref<string | null>(null);

  /** Base path for ajax endpoints (same source the cargo link uses). */
  function basePath(): string {
    return (
      (typeof window !== "undefined" && window.__TMWE_SHIPMENT__?.basePath) ||
      "/bff/v1"
    );
  }

  function openInTab(url: string): void {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  /**
   * Build the label-file URL with the requested conversion format. The backend
   * (ajax_get_label_file) converts the stored binary on the fly via ?format=,
   * so the same item URL serves both PDF and image. Returns '' when no url.
   */
  function labelUrl(it: CourierLabelItem, format: "pdf" | "image"): string {
    if (!it.url) return "";
    // Absoluta: la impresion monta un documento blob: con estas <img>, y en un blob: una ruta relativa
    // ("/bff/v1/...") no tiene base y el navegador ni la pide (pagina de impresion en blanco, 1001084298).
    const url = absoluteUrl(bffLabelFileUrl(it.url, basePath()));
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}format=${format}`;
  }

  // La UI NO gira las etiquetas: la orientacion (las de UPS/FedEx llegan apaisadas) la corrigen los workers de
  // imagen/PDF, asi que el JPG/PDF que sirve el API ya sale de pie.

  /**
   * One-click print of the courier label — the most-used action. Fetches the
   * label list and opens a print-ready window with every label image, then
   * auto-triggers the browser print dialog.
   *
   * Uses the IMAGE format on purpose: the JPG is served straight from disk
   * (~0.05s), whereas the PDF adds an embed render step. For printing, the
   * image is the fastest path to paper.
   */
  async function print(): Promise<void> {
    const sid = shipmentId();
    if (!sid) return;
    if (!awb()) {
      toasts.push("warning", t("shipment.awb.toast_awb_unassigned"));
      return;
    }
    printing.value = true;
    try {
      const r = await labelsService.getCourierLabels(sid);
      if (!r.success) {
        toasts.push(
          "error",
          r.error ??
            r.errors?.map((e) => e.message).join(" · ") ??
            t("common.error"),
        );
        return;
      }
      const labels = (r.labels ?? []).filter((it) => it.is_label && it.url);
      if (!labels.length) {
        toasts.push("warning", t("shipment.awb.no_courier_labels"));
        return;
      }
      const imgs = labels
        .map(
          (it) =>
            `<div class="page"><img src="${labelUrl(it, "image")}" alt="label" /></div>`,
        )
        .join("");
      const html = `
      <!doctype html><html><head><title>${t("shipment.awb.print_title", { awb: awb() })}</title>
      <style>
        body { margin: 0; padding: 8px; font-family: sans-serif; }
        .page { display: flex; align-items: center; justify-content: center;
                overflow: hidden; page-break-after: always; }
        img { max-width: 100%; max-height: 96vh; display: block; margin: 0 auto; }
        @media print {
          body { padding: 0; }
          .page { height: 100vh; }
          @page { size: auto; margin: 6mm; }
        }
      </style></head>
      <body onload="setTimeout(function(){window.print()},250)">${imgs}</body></html>`;
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toasts.push("error", (e as Error).message);
    } finally {
      printing.value = false;
    }
  }

  /** Open the full courier-labels preview dialog and load the list. */
  async function openDialog(): Promise<void> {
    const sid = shipmentId();
    if (!sid) return;
    if (!awb()) {
      toasts.push("warning", t("shipment.awb.toast_awb_unassigned"));
      return;
    }
    dialogOpen.value = true;
    loading.value = true;
    error.value = null;
    list.value = [];
    try {
      const r = await labelsService.getCourierLabels(sid);
      if (!r.success) {
        error.value =
          r.error ??
          r.errors?.map((e) => e.message).join(" · ") ??
          t("common.error");
        return;
      }
      list.value = r.labels ?? [];
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  /** Open the "AWB generated" success dialog and load its labels. */
  async function openSuccess(sid: number): Promise<void> {
    successOpen.value = true;
    successLoading.value = true;
    successLabels.value = [];
    try {
      const r = await labelsService.getCourierLabels(sid);
      if (r.success) {
        successLabels.value = (r.labels ?? []).filter(
          (it) => it.is_label && it.url,
        );
      }
    } finally {
      successLoading.value = false;
    }
  }

  /** Open a courier label in a new tab, converted to PDF or image. */
  function openLabel(it: CourierLabelItem, format: "pdf" | "image"): void {
    const url = labelUrl(it, format);
    if (url) openInTab(url);
    else toasts.push("warning", t("shipment.awb.no_courier_labels"));
  }

  /** Trigger a download of a courier label in the requested format. */
  function downloadLabel(it: CourierLabelItem, format: "pdf" | "image"): void {
    const url = labelUrl(it, format);
    if (!url) {
      toasts.push("warning", t("shipment.awb.no_courier_labels"));
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = `label_${it.package}.${format === "pdf" ? "pdf" : "jpg"}`;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /** Real courier labels (excludes auxiliary docs) — drives the dialog's
   *  print / download-all header actions. */
  const items = computed<CourierLabelItem[]>(() =>
    list.value.filter((it) => it.is_label && Boolean(it.url)),
  );

  /** Hay etiquetas reales, ya sea en el diálogo completo o en el de «AWB generada». */
  const hasLabels = (): boolean =>
    items.value.length > 0 || successLabels.value.length > 0;

  /**
   * Descarga generada en el servidor, de todos los bultos o solo de la selección (`packages`): un PDF combinado
   * (una etiqueta por página) o un ZIP con una imagen por bulto.
   */
  function downloadScope(sel: LabelSelection): void {
    const sid = shipmentId();
    if (!sid || !hasLabels()) {
      toasts.push("warning", t("shipment.awb.no_courier_labels"));
      return;
    }
    const zip = sel.format === "zip";
    const url = zip
      ? courierCombinedZipUrl(basePath(), sid, sel.packages)
      : courierCombinedPdfUrl(basePath(), sid, sel.packages);
    const a = document.createElement("a");
    a.href = url;
    a.download = `labels_${awb() || sid}.${zip ? "zip" : "pdf"}`;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadAll(): void {
    downloadScope({ scope: "all", packages: null, format: "pdf" });
  }

  /** Imprime la selección desde el PDF que genera el servidor (no se monta HTML en el navegador). */
  async function printScope(sel: LabelSelection): Promise<void> {
    const sid = shipmentId();
    if (!sid || printing.value) return;
    if (!hasLabels()) {
      toasts.push("warning", t("shipment.awb.no_courier_labels"));
      return;
    }
    printing.value = true;
    try {
      await printPdfFromUrl(
        courierCombinedPdfUrl(basePath(), sid, sel.packages, true),
      );
    } catch (e) {
      toasts.push("error", (e as Error).message);
    } finally {
      printing.value = false;
    }
  }

  function title(it: CourierLabelItem): string {
    if (it.is_label) return t("shipment.awb.label_label", { n: it.package });
    return t("shipment.awb.label_auxiliar", {
      n: it.package,
      num: it.auxiliar_number ?? 1,
    });
  }

  function subtitle(it: CourierLabelItem): string {
    const parts: string[] = [];
    if (it.description) parts.push(String(it.description));
    if (it.ext) parts.push(`.${String(it.ext).toLowerCase()}`);
    return parts.join(" · ");
  }

  return {
    // full dialog
    dialogOpen,
    loading,
    error,
    list: list as Ref<CourierLabelItem[]>,
    items,
    printing,
    // success dialog
    successOpen,
    successLoading,
    successLabels: successLabels as Ref<CourierLabelItem[]>,
    generatedTracking,
    // actions
    print,
    openDialog,
    openSuccess,
    openLabel,
    downloadLabel,
    downloadAll,
    downloadScope,
    printScope,
    // presentational helpers
    labelUrl,
    title,
    subtitle,
  };
}
