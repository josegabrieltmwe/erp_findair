/**
 * Store del wizard de importación masiva. Mantiene el modo (express|cargo), el
 * CSV pegado/subido, el mapping, el resultado de preview y el de import. Errores
 * de red → toasts globales del http client; aquí solo orquestación.
 */
import { defineStore } from "pinia";
import { ref } from "vue";
import { bulkService } from "../services/bulk.service";
import type {
  BulkMode,
  MappingResponse,
  PreviewResult,
  ImportResult,
} from "../types";

export const useBulkStore = defineStore("bulk", () => {
  const mode = ref<BulkMode>("express");
  const step = ref(1); // 1=upload, 2=preview, 3=result
  const csvData = ref("");
  const delimiter = ref(",");

  const mapping = ref<MappingResponse | null>(null);
  const preview = ref<PreviewResult | null>(null);
  const result = ref<ImportResult | null>(null);

  const loading = ref(false);
  const importing = ref(false);

  function setMode(m: BulkMode): void {
    mode.value = m;
    mapping.value = null;
    preview.value = null;
    result.value = null;
    step.value = 1;
  }

  function reset(): void {
    csvData.value = "";
    preview.value = null;
    result.value = null;
    step.value = 1;
  }

  async function loadMapping(): Promise<void> {
    loading.value = true;
    try {
      mapping.value = await bulkService.mapping(mode.value);
    } finally {
      loading.value = false;
    }
  }

  async function runPreview(): Promise<void> {
    loading.value = true;
    try {
      preview.value = await bulkService.preview(
        mode.value,
        csvData.value,
        delimiter.value,
      );
      step.value = 2;
    } finally {
      loading.value = false;
    }
  }

  async function runImport(): Promise<void> {
    if (!preview.value?.valid_rows?.length) return;
    importing.value = true;
    try {
      result.value = await bulkService.import(
        mode.value,
        preview.value.valid_rows,
      );
      step.value = 3;
    } finally {
      importing.value = false;
    }
  }

  return {
    mode,
    step,
    csvData,
    delimiter,
    mapping,
    preview,
    result,
    loading,
    importing,
    setMode,
    reset,
    loadMapping,
    runPreview,
    runImport,
  };
});
