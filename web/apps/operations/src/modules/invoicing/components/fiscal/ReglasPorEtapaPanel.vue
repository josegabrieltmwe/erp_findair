<template>
  <div>
    <v-alert type="info" variant="tonal" density="compact" class="mb-3">
      {{ t("invoicing.fiscal.reglas.aviso") }}
      <span v-if="store.catalogo">
        {{
          store.dobleFirma
            ? t("invoicing.fiscal.reglas.aviso_doble")
            : t("invoicing.fiscal.reglas.aviso_simple")
        }}
      </span>
    </v-alert>

    <div class="d-flex align-center flex-wrap ga-2 mb-2">
      <div class="text-subtitle-1 font-weight-medium">
        {{ t("invoicing.fiscal.reglas.title") }}
      </div>
      <v-spacer />
      <v-btn
        v-if="config.canWrite"
        color="primary"
        prepend-icon="mdi-plus"
        size="small"
        @click="openWizard(null)"
      >
        {{ t("invoicing.fiscal.reglas.nueva") }}
      </v-btn>
      <v-btn
        variant="text"
        icon="mdi-refresh"
        size="small"
        :title="t('common.refresh')"
        :aria-label="t('common.refresh')"
        :loading="loading"
        @click="load"
      />
    </div>

    <!-- Filtros -->
    <div class="filters mb-3">
      <v-select
        v-model="store.filters.estado"
        :items="estadoItems"
        :label="t('invoicing.fiscal.reglas.filtro.estado')"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        @update:model-value="reloadRules"
      />
      <v-select
        v-model="store.filters.accion"
        :items="accionFilterItems"
        :label="t('invoicing.fiscal.reglas.filtro.accion')"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        @update:model-value="reloadRules"
      />
      <v-text-field
        v-model="store.filters.iso_paese"
        :label="t('invoicing.fiscal.reglas.filtro.pais')"
        maxlength="2"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        @update:model-value="reloadRules"
      />
      <v-text-field
        v-model="store.filters.fecha"
        type="date"
        :label="t('invoicing.fiscal.reglas.filtro.fecha')"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        @update:model-value="reloadRules"
      />
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-2"
      role="alert"
    >
      {{ error }}
    </v-alert>
    <v-progress-linear v-if="loading && !catalogo" indeterminate />

    <!-- Panel de conflictos (todas las reglas) -->
    <v-expansion-panels
      v-if="catalogo"
      v-model="conflictosOpen"
      variant="accordion"
      class="mb-3"
    >
      <v-expansion-panel value="conflictos">
        <v-expansion-panel-title>
          <v-icon
            :icon="
              store.conflictos.length
                ? 'mdi-alert-outline'
                : 'mdi-check-circle-outline'
            "
            :color="store.conflictos.length ? 'warning' : 'success'"
            class="mr-2"
          />
          {{ t("invoicing.fiscal.reglas.conflictos.title") }}
          <v-chip
            size="x-small"
            :color="store.conflictos.length ? 'warning' : undefined"
            variant="flat"
            class="ml-2"
          >
            {{ store.conflictos.length }}
          </v-chip>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <ConflictsPanel
            :conflictos="store.conflictos"
            :loading="loading"
            :title="t('invoicing.fiscal.reglas.conflictos.title')"
          />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-expansion-panels
      v-if="catalogo"
      v-model="open"
      multiple
      variant="accordion"
    >
      <v-expansion-panel
        v-for="etapa in catalogo.etapas"
        :key="etapa.etapa"
        :value="etapa.etapa"
      >
        <v-expansion-panel-title>
          <div class="d-flex align-center flex-wrap ga-2 w-100">
            <span class="font-weight-medium">
              {{ etapa.orden }}. {{ stageName(etapa) }}
            </span>
            <v-chip size="x-small" variant="outlined">
              {{
                etapa.por_expedicion
                  ? t("invoicing.fiscal.reglas.por_expedicion")
                  : t("invoicing.fiscal.reglas.por_factura")
              }}
            </v-chip>
            <v-chip
              v-for="p in etapa.politicas"
              :key="p"
              size="x-small"
              variant="tonal"
              color="primary"
              :title="t(`invoicing.fiscal.reglas.politica_desc.${p}`)"
            >
              {{ t(`invoicing.fiscal.reglas.politica.${p}`) }}
            </v-chip>
            <v-spacer />
            <v-chip
              size="x-small"
              :color="count(etapa.etapa) ? 'success' : undefined"
              variant="flat"
            >
              {{
                t("invoicing.fiscal.reglas.n_reglas", { n: count(etapa.etapa) })
              }}
            </v-chip>
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="text-caption text-medium-emphasis mb-2">
            {{ policyText(etapa) }}
          </div>

          <!-- Reglas configurables (fisc_reglas) -->
          <v-table v-if="store.deEtapa(etapa.etapa).length" density="compact">
            <thead>
              <tr>
                <th scope="col">
                  {{ t("invoicing.fiscal.reglas.col_regla") }}
                </th>
                <th scope="col">
                  {{ t("invoicing.fiscal.reglas.col_estado") }}
                </th>
                <th scope="col">
                  {{ t("invoicing.fiscal.reglas.col_ambito") }}
                </th>
                <th scope="col">{{ t("invoicing.fiscal.vigencia") }}</th>
                <th scope="col">
                  {{ t("invoicing.fiscal.reglas.col_prioridad") }}
                </th>
                <th scope="col">
                  {{ t("invoicing.fiscal.reglas.col_condicion") }}
                </th>
                <th scope="col">
                  {{ t("invoicing.fiscal.reglas.col_accion") }}
                </th>
                <th scope="col">
                  <span class="sr-only">{{ t("common.actions") }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in store.deEtapa(etapa.etapa)" :key="r.id">
                <td>
                  <div class="font-weight-medium">{{ r.codigo }}</div>
                  <div
                    v-if="r.nombre"
                    class="text-caption text-medium-emphasis"
                  >
                    {{ r.nombre }}
                  </div>
                </td>
                <td>
                  <v-chip
                    size="x-small"
                    :color="estadoColor(r.estado)"
                    variant="flat"
                  >
                    {{ t(`invoicing.fiscal.reglas.estado.${r.estado}`) }}
                  </v-chip>
                  <v-chip
                    v-if="r.n_conflictos"
                    size="x-small"
                    color="warning"
                    variant="tonal"
                    class="ml-1"
                    :title="t('invoicing.fiscal.reglas.conflictos.title')"
                  >
                    <v-icon icon="mdi-alert-outline" size="12" start />
                    {{ r.n_conflictos }}
                  </v-chip>
                </td>
                <td>{{ ambitoText(r, t("invoicing.fiscal.all")) }}</td>
                <td class="text-no-wrap">
                  {{ r.data_inizio }} →
                  {{ r.data_fine ?? t("invoicing.fiscal.open") }}
                </td>
                <td>{{ r.prioridad }}</td>
                <td>{{ condShort(r) }}</td>
                <td>
                  <div class="font-weight-medium" :title="r.accion">
                    {{ nombreAccion(r.accion) }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ resumen(r) }}
                  </div>
                </td>
                <td class="text-no-wrap">
                  <v-btn
                    icon="mdi-eye-outline"
                    size="x-small"
                    variant="text"
                    :title="t('invoicing.fiscal.reglas.acciones_fila.ver')"
                    :aria-label="`${t('invoicing.fiscal.reglas.acciones_fila.ver')} ${r.codigo}`"
                    @click="openWizard(r.id)"
                  />
                  <v-btn
                    v-if="config.canWrite && r.estado === 'BORRADOR'"
                    icon="mdi-pencil-outline"
                    size="x-small"
                    variant="text"
                    color="primary"
                    :title="t('invoicing.fiscal.reglas.acciones_fila.editar')"
                    :aria-label="`${t('invoicing.fiscal.reglas.acciones_fila.editar')} ${r.codigo}`"
                    @click="openWizard(r.id)"
                  />
                  <v-btn
                    v-if="config.canWrite && r.estado === 'PENDIENTE'"
                    icon="mdi-check-decagram-outline"
                    size="x-small"
                    variant="text"
                    color="warning"
                    :title="t('invoicing.fiscal.reglas.acciones_fila.aprobar')"
                    :aria-label="`${t('invoicing.fiscal.reglas.acciones_fila.aprobar')} ${r.codigo}`"
                    @click="openWizard(r.id)"
                  />
                  <v-btn
                    v-if="config.canWrite && r.estado === 'ACTIVA'"
                    icon="mdi-calendar-end"
                    size="x-small"
                    variant="text"
                    color="primary"
                    :title="t('invoicing.fiscal.reglas.acciones_fila.cerrar')"
                    :aria-label="`${t('invoicing.fiscal.reglas.acciones_fila.cerrar')} ${r.codigo}`"
                    @click="openAction(r, 'close')"
                  />
                  <v-btn
                    v-if="config.canWrite && r.estado !== 'CERRADA'"
                    icon="mdi-delete-outline"
                    size="x-small"
                    variant="text"
                    color="error"
                    :title="t('invoicing.fiscal.reglas.acciones_fila.baja')"
                    :aria-label="`${t('invoicing.fiscal.reglas.acciones_fila.baja')} ${r.codigo}`"
                    @click="openAction(r, 'deactivate')"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Reglas de valores y requisitos (F6a: se editan en sus pestañas) -->
          <template v-if="rulesOf(etapa.etapa).length">
            <div class="text-caption text-medium-emphasis mt-3 mb-1">
              {{ t("invoicing.fiscal.reglas.legacy") }}
            </div>
            <v-table density="compact">
              <thead>
                <tr>
                  <th scope="col">
                    {{ t("invoicing.fiscal.reglas.col_origen") }}
                  </th>
                  <th scope="col">
                    {{ t("invoicing.fiscal.reglas.col_regla") }}
                  </th>
                  <th scope="col">
                    {{ t("invoicing.fiscal.reglas.col_ambito") }}
                  </th>
                  <th scope="col">
                    {{ t("invoicing.fiscal.reglas.col_condicion") }}
                  </th>
                  <th scope="col">
                    {{ t("invoicing.fiscal.reglas.col_valor") }}
                  </th>
                  <th scope="col">{{ t("invoicing.fiscal.vigencia") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in rulesOf(etapa.etapa)"
                  :key="`${r.tabla}-${r.id}`"
                >
                  <td>
                    <v-chip size="x-small" variant="outlined">{{
                      t(`invoicing.fiscal.tabla.${r.tabla}`)
                    }}</v-chip>
                  </td>
                  <td class="font-weight-medium">{{ r.nombre }}</td>
                  <td>{{ r.ambito }}</td>
                  <td>{{ r.condicion }}</td>
                  <td>{{ r.valor }}</td>
                  <td class="text-no-wrap">
                    {{ r.desde }} → {{ r.hasta ?? t("invoicing.fiscal.open") }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </template>

          <div
            v-if="
              !store.deEtapa(etapa.etapa).length && !rulesOf(etapa.etapa).length
            "
            class="text-body-2 text-medium-emphasis mb-2"
          >
            {{ t("invoicing.fiscal.reglas.sin_reglas") }}
          </div>

          <!-- Acciones del catálogo de la etapa -->
          <div v-if="accionesOf(etapa.etapa).length" class="mt-3">
            <div class="text-caption text-medium-emphasis mb-1">
              {{ t("invoicing.fiscal.reglas.acciones") }}
            </div>
            <div class="d-flex flex-wrap ga-1">
              <v-chip
                v-for="a in accionesOf(etapa.etapa)"
                :key="a.codigo"
                size="small"
                :variant="a.implementada ? 'flat' : 'outlined'"
                :color="a.implementada ? 'success' : undefined"
                :title="`${a.codigo}: ${descAccion(a)}`"
              >
                {{ nombreAccion(a.codigo) }}
                <template v-if="!a.implementada">
                  · {{ t("invoicing.fiscal.reglas.proxima", { fase: a.fase }) }}
                </template>
              </v-chip>
            </div>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <RuleWizardDialog
      v-model="wizardOpen"
      :rule-id="wizardRule"
      :today="config.hoy"
      @changed="reloadRules"
    />
    <RuleActionDialog
      v-model="actionOpen"
      :regla="actionRule"
      :action="actionKind"
      :today="config.hoy"
      @done="reloadRules"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * ReglasPorEtapaPanel — pestaña «Reglas» de Configuración fiscal
 * (REGLAS_DINAMICAS §3.8, F6a y F6b). Muestra, por etapa del pipeline, la
 * política de conflicto y las reglas que actúan en ella:
 *   - las reglas configurables de `fisc_reglas` (F6b), con estado
 *     (BORRADOR, PENDIENTE, ACTIVA, CERRADA), ámbito, vigencia, prioridad,
 *     resumen de condición y de acción, y sus conflictos; con permiso de
 *     escritura, el asistente de regla (alta, edición del borrador, vista
 *     previa, activar y aprobar) y cerrar o dar de baja;
 *   - las reglas de valores y requisitos de F6a (`op=list` de
 *     api_fisc_config), que se siguen editando en sus pestañas.
 * Filtros por estado, acción, país y fecha de vigencia, y un panel con los
 * conflictos entre todas las reglas.
 *
 * `?regla=<id>` en la URL abre esa regla (enlace desde «Por qué»).
 *
 * Los botones de escritura se ocultan sin permiso (`canWrite`), pero el bloqueo
 * real lo hace el backend (solo operadores de TMWE).
 *
 * Props: ninguna (usa los stores de configuración y de reglas). Emits: ninguno.
 *
 * Ejemplo:
 *   <ReglasPorEtapaPanel v-if="visited.has('reglas')" />
 */
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fiscConfigService,
  type FiscAccion,
  type FiscEtapa,
  type FiscRow,
} from "../../services/fiscConfig.service";
import type { Regla } from "../../services/fiscReglas.service";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";
import { useFiscReglasStore } from "../../stores/fiscReglas.store";
import { stageOfRule, summarizeCondition } from "./conditionModel";
import { cellText, num } from "./fiscFields";
import ConflictsPanel from "./reglas/ConflictsPanel.vue";
import RuleActionDialog from "./reglas/RuleActionDialog.vue";
import RuleWizardDialog from "./reglas/RuleWizardDialog.vue";
import {
  accionNombre,
  ambitoText,
  estadoColor,
  resumenAccion,
} from "./reglas/reglasModel";

interface StageRule {
  tabla: "valori" | "requisiti";
  id: number;
  etapa: string;
  nombre: string;
  ambito: string;
  condicion: string;
  valor: string;
  desde: string;
  hasta: string | null;
}

const { t, te, locale } = useI18n();

/** Nombre de negocio de una acción (el código queda en el tooltip). */
function nombreAccion(codigo: string): string {
  return accionNombre(codigo, (k, n) => (te(k) ? t(k, n ?? {}) : null));
}

/** Resumen de la acción de una fila en el idioma de la interfaz. */
function resumen(r: {
  accion: string;
  params: Record<string, unknown>;
  resumen_accion: string;
}): string {
  return resumenAccion(
    r.accion,
    r.params,
    locale.value,
    (k, n) => (te(k) ? t(k, n ?? {}) : null),
    r.resumen_accion,
  );
}

/** Descripción de una acción en el idioma de la interfaz; la del catálogo si no hay traducción. */
function descAccion(a: { codigo: string; descripcion: string }): string {
  const key = `invoicing.fiscal.reglas.acciones_desc.${a.codigo}`;
  return te(key) ? t(key) : a.descripcion;
}
const route = useRoute();
const config = useFiscConfigStore();
const store = useFiscReglasStore();

const catalogo = computed(() => store.catalogo);
const rules = ref<StageRule[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const open = ref<string[]>(["RECARGOS", "IMPUESTOS"]);
const conflictosOpen = ref<string | undefined>(undefined);

const wizardOpen = ref(false);
const wizardRule = ref<number | null>(null);
const actionOpen = ref(false);
const actionRule = ref<Regla | null>(null);
const actionKind = ref<"close" | "deactivate">("close");

const estadoItems = computed(() =>
  (catalogo.value?.estados ?? []).map((e) => ({
    title: t(`invoicing.fiscal.reglas.estado.${e}`),
    value: e,
  })),
);
const accionFilterItems = computed(() =>
  store.acciones.filter((a) => a.crea_regla).map((a) => a.codigo),
);

function stageName(e: FiscEtapa): string {
  return e.etiquetas[String(locale.value)] ?? e.etiquetas.en ?? e.etapa;
}

function count(etapa: string): number {
  return rulesOf(etapa).length + store.deEtapa(etapa).length;
}

function rulesOf(etapa: string): StageRule[] {
  return rules.value.filter((r) => r.etapa === etapa);
}

function accionesOf(etapa: string): FiscAccion[] {
  return (catalogo.value?.acciones ?? []).filter((a) => a.etapa === etapa);
}

/** Frase con la política de conflicto de la etapa (o aviso si no tiene acciones). */
function policyText(e: FiscEtapa): string {
  if (e.politicas.length === 0)
    return t("invoicing.fiscal.reglas.sin_politica");
  return e.politicas
    .map((p) => t(`invoicing.fiscal.reglas.politica_desc.${p}`))
    .join(" · ");
}

/** Condición de una regla de fisc_reglas en el idioma de la pantalla. */
function condShort(r: Regla): string {
  if (!r.condicion_json) return t("invoicing.fiscal.reglas.wizard.siempre");
  return (
    summarizeCondition(r.condicion_json, catalogo.value, {
      t,
      lang: String(locale.value),
    }) || r.resumen_condicion
  );
}

function scope(row: FiscRow): string {
  const all = t("invoicing.fiscal.all");
  const parts = [
    cellText("iso_paese", row.iso_paese ?? "", all),
    Number(row.id_partner ?? 0) ? `P${String(row.id_partner)}` : "",
    Number(row.id_cliente ?? 0) ? `C${String(row.id_cliente)}` : "",
  ].filter((x) => x !== "");
  return parts.join(" · ") || all;
}

function condText(row: FiscRow): string {
  const text = summarizeCondition(
    String(row.condicion_json ?? "") || String(row.condicion ?? ""),
    catalogo.value,
    { t, lang: String(locale.value) },
  );
  return text || String(row.condicion ?? "");
}

function valorText(row: FiscRow): string {
  const parts: string[] = [];
  if (
    row.valore_perc !== null &&
    row.valore_perc !== undefined &&
    row.valore_perc !== ""
  ) {
    parts.push(`${num(row.valore_perc)} %`);
  }
  if (
    row.valore_fisso !== null &&
    row.valore_fisso !== undefined &&
    row.valore_fisso !== ""
  ) {
    parts.push(num(row.valore_fisso));
  }
  return parts.join(" + ");
}

function openWizard(id: number | null): void {
  wizardRule.value = id;
  wizardOpen.value = true;
}

function openAction(r: Regla, kind: "close" | "deactivate"): void {
  actionRule.value = r;
  actionKind.value = kind;
  actionOpen.value = true;
}

/** Recarga solo las reglas de fisc_reglas y sus conflictos (tras un cambio o un filtro). */
async function reloadRules(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    await store.loadReglas();
    if (store.error) error.value = store.error;
  } finally {
    loading.value = false;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    await Promise.all([store.loadCatalogo(), config.load()]);
    await store.loadReglas();
    if (store.error) error.value = store.error;
    const [valori, requisiti] = await Promise.all([
      fiscConfigService.list("valori"),
      fiscConfigService.list("requisiti"),
    ]);
    const out: StageRule[] = [];
    for (const r of valori) {
      const voce = config.meta?.voci.find(
        (v) => v.id === Number(r.id_voce) || v.codice === r.voce_codice,
      );
      out.push({
        tabla: "valori",
        id: Number(r.id),
        etapa: stageOfRule("valori", voce) ?? "RECARGOS",
        nombre: String(r.voce_codice ?? voce?.codice ?? r.id_voce ?? ""),
        ambito: scope(r),
        condicion: condText(r),
        valor: valorText(r),
        desde: r.data_inizio,
        hasta: r.data_fine,
      });
    }
    for (const r of requisiti) {
      out.push({
        tabla: "requisiti",
        id: Number(r.id),
        etapa: "VALIDACION",
        nombre: String(r.dato ?? ""),
        ambito: scope(r),
        condicion: condText(r),
        valor: `${String(r.documento ?? "")} · ${r.obligatorio === "S" ? t("invoicing.fiscal.cond.yes") : t("invoicing.fiscal.cond.no")}`,
        desde: r.data_inizio,
        hasta: r.data_fine,
      });
    }
    rules.value = out;
  } catch (e) {
    error.value = toUserMessage(e, String(e));
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load().then(() => {
    // Enlace desde el panel «Por qué» de la factura: ?tab=reglas&regla=<id> abre la regla.
    const id = Number(route.query.regla ?? 0);
    if (id > 0) openWizard(id);
  });
});
</script>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
</style>
