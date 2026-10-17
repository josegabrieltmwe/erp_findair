import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fiscReglasService,
  type Regla,
  type ReglaAccion,
  type ReglaConflicto,
  type ReglasCatalogo,
  type ReglasFilters,
} from "../services/fiscReglas.service";
import { useFiscConfigStore } from "./fiscConfig.store";

/**
 * Estado de la pestaña «Reglas» (F6b): el catálogo de `api_fisc_reglas`
 * (acciones con su esquema, estados y si la doble firma está activa), el
 * listado de reglas con sus filtros y los conflictos entre ellas.
 *
 * El catálogo se carga una vez y también alimenta al constructor de
 * condiciones (`useFiscConfigStore().catalogo`), que lee de ahí los datos
 * disponibles por etapa. `canWrite` sale del store de configuración fiscal:
 * solo decide qué botones se ven; el bloqueo real lo hace el backend.
 */
export const useFiscReglasStore = defineStore("invoicing-fisc-reglas", () => {
  const config = useFiscConfigStore();
  const catalogo = ref<ReglasCatalogo | null>(null);
  const reglas = ref<Regla[]>([]);
  const conflictos = ref<ReglaConflicto[]>([]);
  const filters = ref<ReglasFilters>({});
  const loading = ref(false);
  const error = ref<string | null>(null);

  const dobleFirma = computed(() => catalogo.value?.doble_firma ?? true);
  const acciones = computed<ReglaAccion[]>(
    () => catalogo.value?.acciones ?? [],
  );

  /** Acciones con las que se puede crear una regla en una etapa. */
  function accionesDe(etapa: string): ReglaAccion[] {
    return acciones.value.filter((a) => a.etapa === etapa && a.crea_regla);
  }

  function accion(codigo: string): ReglaAccion | null {
    return acciones.value.find((a) => a.codigo === codigo) ?? null;
  }

  /** Carga el catálogo una vez; deja una copia en el store de configuración para el ConditionBuilder. */
  async function loadCatalogo(force = false): Promise<void> {
    if (catalogo.value && !force) return;
    try {
      catalogo.value = await fiscReglasService.catalogo();
      config.catalogo = catalogo.value;
    } catch (e) {
      error.value = toUserMessage(e, String(e));
    }
  }

  /** Recarga el listado (con los filtros actuales) y los conflictos de todas las reglas. */
  async function loadReglas(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const [lista, conf] = await Promise.all([
        fiscReglasService.list({ ...filters.value, con_conflictos: true }),
        fiscReglasService.conflictos(),
      ]);
      reglas.value = lista;
      conflictos.value = conf.conflictos;
    } catch (e) {
      error.value = toUserMessage(e, String(e));
    } finally {
      loading.value = false;
    }
  }

  /** Reglas de una etapa. */
  function deEtapa(etapa: string): Regla[] {
    return reglas.value.filter((r) => r.etapa === etapa);
  }

  /** Conflictos en los que participa una regla. */
  function conflictosDe(id: number): ReglaConflicto[] {
    return conflictos.value.filter((c) => c.id_a === id || c.id_b === id);
  }

  return {
    catalogo,
    reglas,
    conflictos,
    filters,
    loading,
    error,
    dobleFirma,
    acciones,
    accionesDe,
    accion,
    loadCatalogo,
    loadReglas,
    deEtapa,
    conflictosDe,
  };
});
