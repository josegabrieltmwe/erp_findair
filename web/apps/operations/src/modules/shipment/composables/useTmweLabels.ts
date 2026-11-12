import { ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shipment/stores/toast.store";
import {
  labelsService,
  type TmweLabelItem,
} from "@shipment/services/labels.service";
import {
  neighborIndexes,
  type LabelSelection,
} from "@shipment/labels/labelPackages";
import { printPdfFromUrl } from "@shipment/labels/printPdf";

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
  /** Bultos ya pedidos (número → etiqueta). Acotada: cada uno es una imagen base64. */
  const cache = ref<Record<number, TmweLabelItem>>({});
  const CACHE_MAX = 12;
  /** Fallo al pedir un bulto concreto (el resto de la galería sigue usable). */
  const itemError = ref<string | null>(null);

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
    cache.value = {};
    itemError.value = null;
    await fetchPackage(sid, 1);
  }

  function remember(n: number, lab: TmweLabelItem): void {
    const next = { ...cache.value, [n]: lab };
    const keys = Object.keys(next).map(Number);
    if (keys.length > CACHE_MAX) {
      // Se descartan los más lejanos al bulto visible.
      keys
        .sort((x, y) => Math.abs(y - n) - Math.abs(x - n))
        .slice(0, keys.length - CACHE_MAX)
        .forEach((k) => delete next[k]);
    }
    cache.value = next;
  }

  /**
   * Pide UN bulto concreto (no todos) — la base de la galería paginada: con cientos de bultos, cargar todos de
   * golpe decodificaba/montaba cientos de imágenes base64 a la vez. `total_packages` viene siempre en la
   * respuesta, así que el primer fetch ya informa de cuántas páginas tiene la galería. Un bulto ya pedido sale
   * de la caché sin red.
   */
  async function fetchPackage(
    sid: number,
    packageNumber: number,
    silent = false,
  ): Promise<void> {
    const hit = cache.value[packageNumber];
    if (hit && !silent) {
      labels.value = [hit];
      currentPackage.value = packageNumber;
      itemError.value = null;
      void prefetchNeighbors(sid, packageNumber);
      return;
    }
    if (hit && silent) return;
    if (!silent) {
      loading.value = true;
      error.value = null;
      itemError.value = null;
    }
    try {
      const r = await labelsService.tmweLabel(sid, {
        output_format: "image",
        package_number: packageNumber,
      });
      if (!r.success) {
        if (silent) return;
        const msg =
          typeof r.error === "string"
            ? r.error
            : (r.error?.message ?? t("shipment.awb.toast_generate_failed"));
        // Primer bulto: la galería no existe. Otro bulto: se queda donde estaba y se ofrece reintentar.
        if (Object.keys(cache.value).length === 0) error.value = msg;
        else itemError.value = msg;
        labels.value = [];
        currentPackage.value = packageNumber;
        return;
      }
      const lab = r.shipment?.labels?.[0];
      totalPackages.value = r.shipment?.total_packages ?? totalPackages.value;
      if (lab) remember(packageNumber, lab);
      if (silent) return;
      labels.value = r.shipment?.labels ?? [];
      currentPackage.value = packageNumber;
      void prefetchNeighbors(sid, packageNumber);
    } catch (e) {
      if (silent) return;
      if (Object.keys(cache.value).length === 0)
        error.value = (e as Error).message;
      else itemError.value = (e as Error).message;
      labels.value = [];
      currentPackage.value = packageNumber;
    } finally {
      if (!silent) loading.value = false;
    }
  }

  /** El siguiente/anterior se piden en segundo plano para que las flechas no esperen a la red. */
  async function prefetchNeighbors(sid: number, n: number): Promise<void> {
    for (const idx of neighborIndexes(n - 1, totalPackages.value)) {
      const num = idx + 1;
      if (!cache.value[num]) await fetchPackage(sid, num, true);
    }
  }

  /** Navega la galería a un bulto concreto (1-based), pidiéndolo a demanda. */
  async function goToPackage(packageNumber: number): Promise<void> {
    const sid = shipmentId();
    if (
      !sid ||
      packageNumber < 1 ||
      packageNumber > totalPackages.value ||
      (packageNumber === currentPackage.value && !itemError.value) ||
      loading.value
    ) {
      return;
    }
    await fetchPackage(sid, packageNumber);
  }

  /** Reintenta el bulto que falló (o la carga inicial). */
  async function retry(): Promise<void> {
    const sid = shipmentId();
    if (!sid) return;
    await fetchPackage(sid, currentPackage.value || 1);
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

  /**
   * Descarga según la selección. Un bulto ya cargado se baja tal cual; el resto lo genera el servidor
   * (PDF con una etiqueta por página, o ZIP con una JPG por bulto), siempre en UN fichero: los navegadores
   * bloquean casi todas las descargas disparadas en serie salvo la primera.
   */
  function downloadScope(sel: LabelSelection): void {
    const sid = shipmentId();
    if (!sid) return;
    if (sel.scope === "current" && sel.packages?.length === 1) {
      const lab = cache.value[sel.packages[0]];
      if (lab) {
        downloadLabel(lab);
        return;
      }
    }
    // Un solo bulto en total: no hace falta zip.
    if (sel.scope === "all" && totalPackages.value <= 1 && labels.value[0]) {
      downloadLabel(labels.value[0]);
      return;
    }
    triggerNavDownload(
      labelsService.tmweBundleUrl(sid, sel.format, { packages: sel.packages }),
    );
  }

  /**
   * Imprime según la selección: el servidor genera el PDF (una etiqueta por página, al tamaño real) y se
   * manda a la impresora desde un iframe oculto. Nada de montar HTML con imágenes base64 en el navegador:
   * con muchos bultos eso congelaba la pestaña y no respetaba el salto de página.
   */
  async function printScope(sel: LabelSelection): Promise<void> {
    const sid = shipmentId();
    if (!sid || printing.value) return;
    printing.value = true;
    try {
      await printPdfFromUrl(
        labelsService.tmweBundleUrl(sid, "pdf", {
          packages: sel.packages,
          inline: true,
        }),
      );
    } catch (e) {
      toasts.push("error", (e as Error).message);
    } finally {
      printing.value = false;
    }
  }

  /** Impresión con un clic desde la tarjeta: todos los bultos, sin abrir la galería. */
  async function printDirect(): Promise<void> {
    await printScope({ scope: "all", packages: null, format: "pdf" });
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
    cache,
    itemError,
    goToPackage,
    retry,
    downloadLabel,
    downloadScope,
    printScope,
    printDirect,
  };
}
