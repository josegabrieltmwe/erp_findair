import { computed, ref, type ComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import { cargoActionsService } from "@cargo/services/cargo_actions.service";

/**
 * Fuente ÚNICA de la lista de documentos AWB del cargo (6 PDFs) y su acción de
 * impresión. Consumido por CargoAzioniCard (sección "Documenti") y por
 * AwbDocsBar (box PDF del modal MAWB) para NO mantener dos listas paralelas —
 * antes estaban copiadas en ambos, con riesgo de divergencia.
 *
 * `kind` DEBE coincidir con EmailableType (ui.store) y el parámetro `type=` de
 * /api_awb_email y /api_awb_documents.
 */
export type CargoDocKind =
  | "mawb"
  | "hawb"
  | "manifest"
  | "pouch"
  | "mawb_colli"
  | "hawb_colli"
  // "ldv" es la EXCEPCIÓN: no es un doc AWB emailable ni pasa por
  // /api_awb_documents; usa ajax_tmwe_label (etiqueta de la expedición). Se
  // incluye aquí solo para renderizarse en la misma barra de documentos.
  | "ldv";

export interface CargoDocAction {
  kind: CargoDocKind;
  /** Etiqueta corta para el botón (MAWB / HAWB / …). */
  label: string;
  /** Icono para el listado con icono por fila (card Azioni). */
  icon: string;
  /** Dispara la generación/descarga del PDF (con toast de error). */
  print: () => void;
}

export interface UseCargoDocuments {
  documents: ComputedRef<CargoDocAction[]>;
  /** true mientras se genera algún PDF (para deshabilitar botones). */
  busy: ComputedRef<boolean>;
}

export function useCargoDocuments(): UseCargoDocuments {
  const { t } = useI18n();
  const toasts = useToastStore();
  const { cargo } = storeToRefs(useCargoStore());

  const cargoId = computed<number | null>(() =>
    cargo.value ? Number(cargo.value.id) : null,
  );

  const busyCount = ref(0);
  const busy = computed(() => busyCount.value > 0);

  /**
   * Ejecuta la acción de PDF y muestra el error estructurado del backend
   * (NO_MAWB / NO_HAWB / CARGO_NOT_FOUND) como toast.
   */
  async function runPdf(
    action: () => Promise<{ ok: boolean; error?: string }>,
  ): Promise<void> {
    if (!cargoId.value) return;
    busyCount.value++;
    try {
      const r = await action();
      if (!r.ok)
        toasts.push("error", r.error ?? t("cargo.azioni.doc_generate_failed"));
    } finally {
      busyCount.value--;
    }
  }

  const documents = computed<CargoDocAction[]>(() => [
    {
      kind: "mawb",
      label: "MAWB",
      icon: "mdi-printer",
      print: () =>
        void runPdf(() => cargoActionsService.openPdfMawb(cargoId.value!)),
    },
    {
      kind: "hawb",
      label: "HAWB",
      icon: "mdi-printer",
      print: () =>
        void runPdf(() => cargoActionsService.openPdfHawb(cargoId.value!)),
    },
    {
      kind: "manifest",
      label: t("cargo.azioni.doc_manifest"),
      icon: "mdi-file-document-outline",
      print: () =>
        void runPdf(() => cargoActionsService.openPdfManifest(cargoId.value!)),
    },
    {
      kind: "pouch",
      label: t("cargo.azioni.doc_pouch"),
      icon: "mdi-tag-outline",
      print: () =>
        void runPdf(() => cargoActionsService.openPdfPouch(cargoId.value!)),
    },
    {
      kind: "mawb_colli",
      label: t("cargo.azioni.doc_master_colli"),
      icon: "mdi-package-variant-closed-plus",
      print: () =>
        void runPdf(() => cargoActionsService.openPdfMcolli(cargoId.value!)),
    },
    {
      kind: "hawb_colli",
      label: t("cargo.azioni.doc_house_colli"),
      icon: "mdi-package-variant-closed",
      print: () =>
        void runPdf(() => cargoActionsService.openPdfHcolli(cargoId.value!)),
    },
  ]);

  return { documents, busy };
}
