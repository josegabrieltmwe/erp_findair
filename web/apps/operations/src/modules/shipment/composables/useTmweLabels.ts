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
  /** Bulto(s) actualmente cargados. En la galería (ver fetchPackage) siempre
   *  tiene como máximo 1 elemento — no se cargan todos los bultos de golpe. */
  const labels = ref<TmweLabelItem[]>([]);
  const currentFormat = ref<"image" | "pdf">("image");
  const pdfLoading = ref(false);
  /** True while the one-click internal-LDV print is fetching its labels. */
  const printing = ref(false);
  /** Bulto mostrado actualmente en la galería (1-based). */
  const currentPackage = ref(1);
  /** Total de bultos de la expedición (independiente de cuántos están cargados). */
  const totalPackages = ref(1);

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
      // Un solo PDF con TODOS los bultos (api_label_tmwe_bundle), como cargo.
      // Antes se abría solo labels[0] y se perdían los demás bultos.
      if (pdfLoading.value) return;
      pdfLoading.value = true;
      try {
        const res = await fetch(labelsService.tmweBundleUrl(sid, "pdf"), {
          credentials: "same-origin",
        });
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || !type.includes("pdf")) {
          const body = (await res.json().catch(() => null)) as {
            detail?: string;
            error?: string | { message?: string };
          } | null;
          const msg =
            body?.detail ??
            (typeof body?.error === "string"
              ? body.error
              : body?.error?.message) ??
            t("shipment.awb.toast_generate_failed");
          toasts.push("error", msg);
          return;
        }
        const blob = await res.blob();
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

    // image: open inline preview dialog, galería desde el bulto 1.
    dialogOpen.value = true;
    currentPackage.value = 1;
    totalPackages.value = 1;
    await fetchPackage(sid, 1);
  }

  /**
   * Pide UN bulto concreto (no todos) — la base de la galería paginada: con
   * cientos de bultos, cargar todos de golpe (antes: `tmweLabel(sid, {...})`
   * sin `package_number`) decodificaba/montaba cientos de imágenes base64 a
   * la vez. `total_packages` viene siempre en la respuesta, así que el primer
   * fetch ya informa de cuántas páginas tiene la galería.
   */
  async function fetchPackage(
    sid: number,
    packageNumber: number,
  ): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const r = await labelsService.tmweLabel(sid, {
        output_format: "image",
        package_number: packageNumber,
      });
      if (!r.success) {
        error.value =
          typeof r.error === "string"
            ? r.error
            : (r.error?.message ?? t("shipment.awb.toast_generate_failed"));
        labels.value = [];
        return;
      }
      labels.value = r.shipment?.labels ?? [];
      totalPackages.value = r.shipment?.total_packages ?? labels.value.length;
      currentPackage.value = packageNumber;
    } catch (e) {
      error.value = (e as Error).message;
      labels.value = [];
    } finally {
      loading.value = false;
    }
  }

  /** Navega la galería a un bulto concreto (1-based), pidiéndolo a demanda. */
  async function goToPackage(packageNumber: number): Promise<void> {
    const sid = shipmentId();
    if (
      !sid ||
      packageNumber < 1 ||
      packageNumber > totalPackages.value ||
      packageNumber === currentPackage.value ||
      loading.value
    ) {
      return;
    }
    await fetchPackage(sid, packageNumber);
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

  /** `<a>` de solo-navegación: el navegador gestiona la descarga a partir del
   *  `Content-Disposition: attachment` que devuelve el servidor (misma
   *  técnica que `useCargoLabels.ts::triggerNavDownload`). */
  function triggerNavDownload(url: string): void {
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadAll(): void {
    const sid = shipmentId();
    if (!sid) return;
    if (totalPackages.value > 1) {
      // Varios bultos: un único .zip generado server-side (api_label_tmwe_bundle),
      // no N descargas sueltas — los navegadores bloquean casi todas salvo la
      // primera cuando se disparan varios `<a download>` seguidos sin gesto
      // del usuario por archivo, que es lo que pasaba antes aquí.
      triggerNavDownload(labelsService.tmweBundleUrl(sid, "zip"));
      return;
    }
    // Un solo bulto: no hace falta zip.
    if (labels.value[0]) downloadLabel(labels.value[0]);
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
    currentPackage,
    totalPackages,
    openLabel,
    goToPackage,
    downloadLabel,
    downloadAll,
    printInTab,
    printDirect,
  };
}
