import { ref, computed, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shipment/stores/toast.store";
import {
  labelsService,
  type CourierLabelItem,
} from "@shipment/services/labels.service";

/** Acciones de fichero de etiqueta que el BFF sirve como binario (bff/config/routes.bff.yaml). */
const LABEL_FILE_ACTIONS = ["get_label_file", "get_label_auxiliar_file"] as const;

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

/** ¿Imagen apaisada? Un margen del 5 % evita girar etiquetas casi cuadradas. */
export function isLandscape(width: number, height: number): boolean {
  return width > 0 && height > 0 && width > height * 1.05;
}

/** URL absoluta con el origen de la pagina (sin window, tal cual). Las ya absolutas no cambian. */
export function absoluteUrl(url: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
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

  /**
   * Degrees a label must be rotated CLOCKWISE to read vertically. Some couriers
   * (UPS, FedEx) return landscape labels; the backend flags them via `rotate`
   * ('inverse' = UPS, true = FedEx). 0 means already upright.
   *
   * 270°, not 90°: these labels are laid out with the text running BOTTOM-TO-TOP
   * (rotated counter-clockwise from upright), so turning them a further 90°
   * clockwise left them upside down — the barcode ended up at the top and the
   * address unreadable. Verified against a real FedEx 1400x950 label.
   */
  /**
   * Etiquetas cuya imagen es apaisada (mas ancha que alta), por URL. Se rellena al cargar cada imagen
   * (noteLabelSize) y, para imprimir, precargandolas (detectLandscape): asi se gira cualquier courier aunque el
   * backend no mande `rotate` (p. ej. FedEx 1400x950 en «Ver etiquetas del courier»).
   */
  const landscape = ref(new Set<string>());

  function rotateDeg(it: CourierLabelItem): number {
    const r = it.rotate;
    if (r === "inverse") return 270;
    if (r === true || r === "true") return 270;
    if (it.url && landscape.value.has(it.url)) return 270;
    return 0;
  }

  /** Apunta si la imagen cargada de la etiqueta es apaisada (handler de @load de la <img>). */
  function noteLabelSize(it: CourierLabelItem, ev: Event): void {
    const img = ev.target as HTMLImageElement | null;
    if (!it.url || !img) return;
    if (isLandscape(img.naturalWidth, img.naturalHeight) && !landscape.value.has(it.url)) {
      landscape.value = new Set(landscape.value).add(it.url);
    }
  }

  /** Precarga las imagenes de las etiquetas para saber cuales son apaisadas antes de montar la impresion. */
  async function detectLandscape(items: CourierLabelItem[]): Promise<void> {
    await Promise.all(
      items.map(
        (it) =>
          new Promise<void>((resolve) => {
            if (!it.url || landscape.value.has(it.url) || typeof Image === "undefined") return resolve();
            const img = new Image();
            img.onload = () => {
              if (isLandscape(img.naturalWidth, img.naturalHeight)) {
                landscape.value = new Set(landscape.value).add(it.url as string);
              }
              resolve();
            };
            img.onerror = () => resolve();
            img.src = labelUrl(it, "image");
          }),
      ),
    );
  }

  /**
   * Inline style that rotates a landscape label image to vertical inside its
   * container. When rotated 90°/270° the image's width becomes the container's
   * height, so we size by viewport-relative units and let the wrapper clip.
   */
  function imgStyle(it: CourierLabelItem): Record<string, string> {
    const deg = rotateDeg(it);
    if (!deg) return {};
    return { transform: `rotate(${deg}deg)`, transformOrigin: "center center" };
  }

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
      // Saber cuales son apaisadas antes de montar la pagina: se imprimen giradas.
      await detectLandscape(labels);
      const imgs = labels
        .map((it) => {
          const deg = rotateDeg(it);
          const inner = deg
            ? `<img src="${labelUrl(it, "image")}" alt="label" class="rot" style="transform:rotate(${deg}deg)" />`
            : `<img src="${labelUrl(it, "image")}" alt="label" />`;
          return `<div class="page">${inner}</div>`;
        })
        .join("");
      const html = `
      <!doctype html><html><head><title>${t("shipment.awb.print_title", { awb: awb() })}</title>
      <style>
        body { margin: 0; padding: 8px; font-family: sans-serif; }
        .page { display: flex; align-items: center; justify-content: center;
                overflow: hidden; page-break-after: always; }
        img { max-width: 100%; display: block; margin: 0 auto; }
        /* A rotated label keeps its PRE-rotation layout box (transform is
           visual only), so the landscape image still claims its full width and
           the upright result overflowed the sheet. Sizing it against the
           viewport HEIGHT — which is what becomes on-screen width after the
           90° turn — keeps the whole label on one page, centered. */
        img.rot { max-width: none; max-height: 96vw; width: auto;
                  transform-origin: center center; }
        @media print {
          body { padding: 0; }
          .page { height: 100vh; }
          /* On paper the constraint is the page box: cap by height so the
             rotated label scales down to fit instead of being clipped. */
          img.rot { max-height: 96vw; max-width: none; }
          /* Portrait sheet for upright labels. */
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

  /**
   * Download ALL courier labels as a single combined PDF (one label per page),
   * built server-side from the on-disk label images. One file, one click.
   */
  function downloadAll(): void {
    const sid = shipmentId();
    if (!sid || !items.value.length) {
      toasts.push("warning", t("shipment.awb.no_courier_labels"));
      return;
    }
    const url = `${basePath()}/api_label_combined_pdf?shipment_id=${sid}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `labels_${awb() || sid}.pdf`;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
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
    // presentational helpers
    labelUrl,
    rotateDeg,
    imgStyle,
    noteLabelSize,
    title,
    subtitle,
  };
}
