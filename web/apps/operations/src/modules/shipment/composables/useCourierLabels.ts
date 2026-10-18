import { ref, computed, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shipment/stores/toast.store";
import {
  labelsService,
  type CourierLabelItem,
} from "@shipment/services/labels.service";

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
    const sep = it.url.includes("?") ? "&" : "?";
    return `${it.url}${sep}format=${format}`;
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
  function rotateDeg(it: CourierLabelItem): number {
    const r = it.rotate;
    if (r === "inverse") return 270;
    if (r === true || r === "true") return 270;
    return 0;
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
    title,
    subtitle,
  };
}
