import { ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shipment/stores/toast.store";
import {
  labelsService,
  type TmweLabelItem,
} from "@shipment/services/labels.service";

/**
 * TMWE internal LDV (label) generation/preview/print, extracted from
 * ServizioCard. The card header (one-click print, PDF open) and the preview
 * dialog both consume this single composable, so the state that used to be
 * entangled across the card now has one home. Behaviour is unchanged.
 */
export function useTmweLabels(shipmentId: () => number) {
  const { t } = useI18n();
  const toasts = useToastStore();

  const dialogOpen = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const labels = ref<TmweLabelItem[]>([]);
  const currentFormat = ref<"image" | "pdf">("image");
  const pdfLoading = ref(false);
  /** True while the one-click internal-LDV print is fetching its labels. */
  const printing = ref(false);

  function base64ToBlob(b64: string, mime: string): Blob {
    const bytes = atob(b64);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    return new Blob([buf], { type: mime });
  }

  function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }

  async function openLabel(format: "image" | "pdf"): Promise<void> {
    const sid = shipmentId();
    if (!sid) return;
    currentFormat.value = format;

    if (format === "pdf") {
      // PDF flow: generate, then open the blob in a new tab (data: URIs are
      // blocked by some browsers for top-level navigation, so we use a Blob
      // URL). It can take a few seconds — show a spinner on the menu entry.
      if (pdfLoading.value) return;
      pdfLoading.value = true;
      try {
        const r = await labelsService.tmweLabel(sid, { output_format: "pdf" });
        if (!r.success || !r.shipment?.labels?.length) {
          const msg =
            typeof r.error === "string"
              ? r.error
              : (r.error?.message ?? t("shipment.awb.toast_generate_failed"));
          toasts.push("error", msg);
          return;
        }
        const first = r.shipment.labels[0];
        const blob = base64ToBlob(first.base64, "application/pdf");
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (e) {
        toasts.push("error", (e as Error).message);
      } finally {
        pdfLoading.value = false;
      }
      return;
    }

    // image: open inline preview dialog
    dialogOpen.value = true;
    loading.value = true;
    error.value = null;
    labels.value = [];
    try {
      const r = await labelsService.tmweLabel(sid, { output_format: "image" });
      if (!r.success) {
        error.value =
          typeof r.error === "string"
            ? r.error
            : (r.error?.message ?? t("shipment.awb.toast_generate_failed"));
        return;
      }
      labels.value = r.shipment?.labels ?? [];
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  function downloadLabel(lab: TmweLabelItem): void {
    const sid = shipmentId();
    const fmt = (lab.format || "jpg").toLowerCase();
    const mime =
      fmt === "pdf"
        ? "application/pdf"
        : fmt === "png"
          ? "image/png"
          : "image/jpeg";
    const ext = fmt === "jpg" ? "jpg" : fmt;
    const filename = `LDV_${sid}_collo${lab.package_number}.${ext}`;
    try {
      const blob = base64ToBlob(lab.base64, mime);
      triggerDownload(blob, filename);
    } catch (e) {
      toasts.push(
        "error",
        t("shipment.awb.toast_download_failed", { msg: (e as Error).message }),
      );
    }
  }

  function downloadAll(): void {
    if (!labels.value.length) return;
    // Browser dialog supports multiple downloads; trigger them sequentially.
    // A true zip bundle would need a JS zip library — out of scope. The
    // N-file case is rare (1 collo is the norm).
    labels.value.forEach((lab, idx) => {
      setTimeout(() => downloadLabel(lab), idx * 150);
    });
  }

  function printInTab(): void {
    if (!labels.value.length) return;
    // Build a tiny HTML doc with all label images side by side, then auto-print.
    const imgs = labels.value
      .map((lab) => {
        if (lab.format === "pdf") {
          return `<embed src="data:application/pdf;base64,${lab.base64}" type="application/pdf" />`;
        }
        return `<img src="data:image/${lab.format};base64,${lab.base64}" alt="LDV" />`;
      })
      .join("");
    const html = `
    <!doctype html><html><head><title>LDV TMWE</title>
    <style>
      body { margin: 0; padding: 8px; font-family: sans-serif; }
      img, embed { max-width: 100%; display: block; margin: 0 0 8px; }
      @media print { body { padding: 0; } }
    </style></head><body onload="window.print()">${imgs}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  /**
   * One-click print of the internal TMWE LDV — parity with the courier print
   * action. Generates the LDV images and auto-prints without opening the
   * preview dialog.
   */
  async function printDirect(): Promise<void> {
    const sid = shipmentId();
    if (!sid) return;
    printing.value = true;
    try {
      const r = await labelsService.tmweLabel(sid, { output_format: "image" });
      if (!r.success || !r.shipment?.labels?.length) {
        const msg =
          typeof r.error === "string"
            ? r.error
            : (r.error?.message ?? t("shipment.awb.toast_generate_failed"));
        toasts.push("error", msg);
        return;
      }
      labels.value = r.shipment.labels;
      printInTab();
    } catch (e) {
      toasts.push("error", (e as Error).message);
    } finally {
      printing.value = false;
    }
  }

  return {
    dialogOpen,
    loading,
    error,
    labels: labels as Ref<TmweLabelItem[]>,
    currentFormat,
    pdfLoading,
    printing,
    openLabel,
    downloadLabel,
    downloadAll,
    printInTab,
    printDirect,
  };
}
