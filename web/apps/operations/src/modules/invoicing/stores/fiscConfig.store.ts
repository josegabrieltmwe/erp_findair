import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fiscConfigService,
  type FiscCatalogo,
  type FiscMeta,
  type FiscTabla,
} from "../services/fiscConfig.service";

/**
 * Datos comunes de «Configuración fiscal»: enumerados, conceptos,
 * intermediarios y permisos (`op=meta`). Se cargan una vez y se refrescan
 * tras dar de alta un concepto o cambiar un intermediario.
 *
 * `canWrite` solo decide qué botones se muestran: el bloqueo real lo hace
 * el backend (Fisc_Config_Policy, R-4).
 */
export const useFiscConfigStore = defineStore("invoicing-fisc-config", () => {
  const meta = ref<FiscMeta | null>(null);
  const catalogo = ref<FiscCatalogo | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const canWrite = computed(() => !!meta.value?.puede_escribir);
  const esTmwe = computed(() => !!meta.value?.es_tmwe);
  const hoy = computed(
    () => meta.value?.hoy ?? new Date().toISOString().slice(0, 10),
  );

  async function load(force = false): Promise<void> {
    if (meta.value && !force) return;
    loading.value = true;
    error.value = null;
    try {
      meta.value = await fiscConfigService.meta();
    } catch (e) {
      error.value = toUserMessage(e, String(e));
    } finally {
      loading.value = false;
    }
  }

  /**
   * Carga el catálogo de datos, operadores, etapas y acciones (`op=catalogo`)
   * una sola vez; lo usan el constructor de condiciones y la pestaña «Reglas».
   * Un fallo se muestra en `error` y deja `catalogo` en null.
   */
  async function loadCatalogo(force = false): Promise<void> {
    if (catalogo.value && !force) return;
    try {
      catalogo.value = await fiscConfigService.catalogo();
    } catch (e) {
      error.value = toUserMessage(e, String(e));
    }
  }

  function enumOf(tabla: FiscTabla | "alertas", field: string): string[] {
    return meta.value?.enums?.[tabla]?.[field] ?? [];
  }

  function isWritable(tabla: FiscTabla): boolean {
    return canWrite.value && !!meta.value?.escribibles.includes(tabla);
  }

  function voceCode(id: unknown): string {
    const v = meta.value?.voci.find((x) => x.id === Number(id));
    return v ? v.codice : String(id ?? "");
  }

  function intermediarioCode(id: unknown): string {
    const i = meta.value?.intermediari.find((x) => x.id === Number(id));
    return i ? i.codice : String(id ?? "");
  }

  return {
    meta,
    catalogo,
    loading,
    error,
    canWrite,
    esTmwe,
    hoy,
    load,
    loadCatalogo,
    enumOf,
    isWritable,
    voceCode,
    intermediarioCode,
  };
});
