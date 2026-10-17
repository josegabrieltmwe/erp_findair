<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1000"
    scrollable
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card aria-labelledby="rule-wizard-title">
      <v-card-title
        id="rule-wizard-title"
        class="text-subtitle-1 d-flex align-center ga-2"
      >
        <v-icon icon="mdi-scale-balance" color="primary" />
        {{
          currentId
            ? t("invoicing.fiscal.reglas.wizard.title_edit", {
                codigo: detalle?.codigo ?? `#${currentId}`,
              })
            : t("invoicing.fiscal.reglas.wizard.title_new")
        }}
        <v-chip
          v-if="detalle"
          size="x-small"
          :color="estadoColor(detalle.estado)"
          variant="flat"
        >
          {{ t(`invoicing.fiscal.reglas.estado.${detalle.estado}`) }}
        </v-chip>
      </v-card-title>

      <v-card-text>
        <v-progress-linear v-if="loading" indeterminate class="mb-2" />
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
          role="alert"
        >
          {{ errorMessage }}
        </v-alert>

        <v-stepper
          v-model="step"
          alt-labels
          flat
          hide-actions
          class="wizard-stepper"
        >
          <v-stepper-header>
            <v-stepper-item
              v-for="it in stepItems"
              :key="it.value"
              :value="it.value"
              :title="it.title"
              :complete="step > it.value"
            />
          </v-stepper-header>
          <v-stepper-window>
            <!-- 1. Objetivo (propuesta 4): la etapa la deduce la acción elegida. -->
            <v-stepper-window-item :value="1">
              <p class="text-body-2 mb-3">
                {{ t("invoicing.fiscal.reglas.wizard.objetivo_intro") }}
              </p>
              <div v-for="g in objetivos" :key="g.grupo" class="mb-3">
                <div class="text-caption text-medium-emphasis mb-1">
                  {{ t(`invoicing.fiscal.reglas.objetivos.${g.grupo}`) }}
                </div>
                <div class="obj-grid">
                  <v-card
                    v-for="a in g.acciones"
                    :key="a.codigo"
                    :variant="regla.accion === a.codigo ? 'tonal' : 'outlined'"
                    :color="regla.accion === a.codigo ? 'primary' : undefined"
                    :disabled="locked"
                    density="compact"
                    class="obj-card"
                    :aria-pressed="regla.accion === a.codigo"
                    @click="elegirObjetivo(a)"
                  >
                    <v-card-title class="text-body-1 font-weight-medium">
                      {{ nombreAccion(a.codigo) }}
                    </v-card-title>
                    <v-card-text class="text-caption">
                      {{ descAccion(a) }}
                    </v-card-text>
                  </v-card>
                </div>
              </div>
              <div
                v-if="errs.etapa || errs.accion"
                class="text-error text-caption"
              >
                {{ errs.etapa || errs.accion }}
              </div>

              <v-expansion-panels variant="accordion" class="mt-2">
                <v-expansion-panel>
                  <v-expansion-panel-title class="text-body-2">
                    {{ t("invoicing.fiscal.reglas.wizard.avanzado_etapas") }}
                    <span v-if="regla.etapa" class="ml-2 text-medium-emphasis"
                      >· {{ etapaNombre }}</span
                    >
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <p class="text-body-2 mb-3">
                      {{ t("invoicing.fiscal.reglas.wizard.etapa_intro") }}
                    </p>
                    <v-radio-group
                      :model-value="regla.etapa"
                      :disabled="locked"
                      hide-details="auto"
                      :aria-label="
                        t('invoicing.fiscal.reglas.wizard.steps.etapa')
                      "
                      @update:model-value="
                        (v: string | null) => setEtapa(v ?? '')
                      "
                    >
                      <v-radio
                        v-for="e in etapasConReglas"
                        :key="e.etapa"
                        :value="e.etapa"
                      >
                        <template #label>
                          <div>
                            <span class="font-weight-medium">
                              {{ e.orden }}. {{ stageName(e) }}
                            </span>
                            <v-chip
                              v-for="p in e.politicas"
                              :key="p"
                              size="x-small"
                              variant="tonal"
                              color="primary"
                              class="ml-1"
                            >
                              {{ t(`invoicing.fiscal.reglas.politica.${p}`) }}
                            </v-chip>
                            <div class="text-caption text-medium-emphasis">
                              {{ accionesTexto(e.etapa) }}
                            </div>
                          </div>
                        </template>
                      </v-radio>
                    </v-radio-group>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-stepper-window-item>

            <!-- 2. Ámbito -->
            <v-stepper-window-item :value="2">
              <ScopePicker
                :model-value="ambito"
                :errors="errs"
                :readonly="locked"
                @update:model-value="setAmbito"
              />
            </v-stepper-window-item>

            <!-- 3. Condición -->
            <v-stepper-window-item :value="3">
              <p class="text-body-2 mb-2">
                {{ t("invoicing.fiscal.reglas.wizard.condicion_intro") }}
              </p>
              <ConditionBuilder
                :model-value="condJson"
                :stage="regla.etapa || null"
                :readonly="locked"
                @update:model-value="condJson = $event"
                @update:valid="condValid = $event"
              />
              <div
                v-if="errs.condicion"
                class="text-caption text-error mt-1"
                role="alert"
              >
                {{ errs.condicion }}
              </div>
            </v-stepper-window-item>

            <!-- 4. Acción -->
            <v-stepper-window-item :value="4">
              <p class="text-body-2 mb-2">
                {{ t("invoicing.fiscal.reglas.wizard.accion_intro") }}
              </p>
              <v-select
                :model-value="regla.accion"
                :items="accionItems"
                item-title="title"
                item-value="value"
                :label="t('invoicing.fiscal.reglas.wizard.accion_label') + ' *'"
                :error-messages="errs.accion ? [errs.accion] : []"
                :disabled="locked"
                density="comfortable"
                variant="outlined"
                @update:model-value="(v: string) => setAccion(v)"
              />
              <v-alert
                v-if="accionActual"
                type="info"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                {{ descAccion(accionActual) }}
                <div class="text-caption mt-1">
                  {{
                    t(
                      `invoicing.fiscal.reglas.politica_desc.${accionActual.politica}`,
                    )
                  }}
                </div>
              </v-alert>
              <ActionParamsForm
                v-if="accionActual"
                v-model="params"
                :accion="accionActual"
                :errors="paramErrs"
                :readonly="locked"
              />
            </v-stepper-window-item>

            <!-- 5. Vigencia y prioridad -->
            <v-stepper-window-item :value="5">
              <div class="vig-grid">
                <v-text-field
                  v-model="regla.data_inizio"
                  type="date"
                  :label="t('invoicing.fiscal.reglas.wizard.desde') + ' *'"
                  :error-messages="errs.data_inizio ? [errs.data_inizio] : []"
                  :disabled="locked"
                  density="comfortable"
                  variant="outlined"
                />
                <v-text-field
                  v-model="regla.data_fine"
                  type="date"
                  :label="t('invoicing.fiscal.reglas.wizard.hasta')"
                  :hint="t('invoicing.fiscal.reglas.wizard.hasta_hint')"
                  persistent-hint
                  :error-messages="errs.data_fine ? [errs.data_fine] : []"
                  :disabled="locked"
                  clearable
                  density="comfortable"
                  variant="outlined"
                />
                <v-text-field
                  :model-value="regla.prioridad"
                  inputmode="numeric"
                  :label="t('invoicing.fiscal.reglas.wizard.prioridad')"
                  :hint="t('invoicing.fiscal.reglas.wizard.prioridad_hint')"
                  persistent-hint
                  :error-messages="errs.prioridad ? [errs.prioridad] : []"
                  :disabled="locked"
                  density="comfortable"
                  variant="outlined"
                  @update:model-value="
                    (v: string) => (regla.prioridad = parseInt(v, 10) || 0)
                  "
                />
                <v-text-field
                  v-model="regla.nombre"
                  :label="t('invoicing.fiscal.reglas.wizard.nombre')"
                  :error-messages="errs.nombre ? [errs.nombre] : []"
                  :disabled="locked"
                  maxlength="100"
                  density="comfortable"
                  variant="outlined"
                />
                <v-text-field
                  v-model="regla.rif_normativo"
                  :label="t('invoicing.fiscal.reglas.wizard.rif')"
                  :hint="t('invoicing.fiscal.reglas.wizard.rif_hint')"
                  persistent-hint
                  :error-messages="
                    errs.rif_normativo ? [errs.rif_normativo] : []
                  "
                  :disabled="locked"
                  maxlength="255"
                  density="comfortable"
                  variant="outlined"
                />
                <v-text-field
                  v-if="!currentId"
                  v-model="codigo"
                  :label="t('invoicing.fiscal.reglas.wizard.codigo')"
                  :hint="t('invoicing.fiscal.reglas.wizard.codigo_hint')"
                  persistent-hint
                  :error-messages="errs.codigo ? [errs.codigo] : []"
                  maxlength="40"
                  density="comfortable"
                  variant="outlined"
                />
              </div>
              <v-textarea
                v-model="regla.descrizione"
                :label="t('invoicing.fiscal.reglas.wizard.descripcion')"
                :disabled="locked"
                rows="2"
                auto-grow
                density="comfortable"
                variant="outlined"
              />
              <div class="text-subtitle-2 mt-2 mb-1">
                {{ t("invoicing.fiscal.reglas.conflictos.title") }}
              </div>
              <ConflictsPanel
                :conflictos="conflictos"
                :loading="conflictosLoading"
                :error="conflictosError"
                :title="t('invoicing.fiscal.reglas.conflictos.title')"
              />
            </v-stepper-window-item>

            <!-- 6. Guardar como borrador -->
            <v-stepper-window-item :value="6">
              <p class="text-body-2 mb-2">
                {{ t("invoicing.fiscal.reglas.wizard.guardar_intro") }}
              </p>
              <v-sheet border rounded class="pa-3 mb-3">
                <dl class="summary">
                  <dt>{{ t("invoicing.fiscal.reglas.wizard.steps.etapa") }}</dt>
                  <dd>{{ etapaNombre }}</dd>
                  <dt>
                    {{ t("invoicing.fiscal.reglas.wizard.steps.ambito") }}
                  </dt>
                  <dd>{{ ambitoText(regla, t("invoicing.fiscal.all")) }}</dd>
                  <dt>
                    {{ t("invoicing.fiscal.reglas.wizard.steps.condicion") }}
                  </dt>
                  <dd>{{ condResumen }}</dd>
                  <dt>
                    {{ t("invoicing.fiscal.reglas.wizard.steps.accion") }}
                  </dt>
                  <dd>
                    {{ nombreAccion(regla.accion) }}
                    <span class="text-medium-emphasis">
                      {{ paramsResumen }}
                    </span>
                  </dd>
                  <dt>
                    {{ t("invoicing.fiscal.reglas.wizard.steps.vigencia") }}
                  </dt>
                  <dd>
                    {{ regla.data_inizio }} →
                    {{ regla.data_fine || t("invoicing.fiscal.open") }} ·
                    {{ t("invoicing.fiscal.reglas.wizard.prioridad") }}
                    {{ regla.prioridad }}
                  </dd>
                </dl>
              </v-sheet>
              <ConflictsPanel
                :conflictos="conflictos"
                :loading="conflictosLoading"
                :error="conflictosError"
                :title="t('invoicing.fiscal.reglas.conflictos.title')"
                class="mb-3"
              />
              <v-text-field
                v-if="!locked"
                v-model="motivoGuardar"
                :label="t('invoicing.fiscal.motivo') + ' *'"
                :hint="t('invoicing.fiscal.motivo_hint')"
                persistent-hint
                :error-messages="errs.motivo ? [errs.motivo] : []"
                density="comfortable"
                variant="outlined"
                maxlength="255"
              />
              <div v-if="!locked" class="mt-2">
                <v-btn
                  color="primary"
                  :loading="busy"
                  :disabled="!canSave"
                  prepend-icon="mdi-content-save-outline"
                  @click="save"
                >
                  {{
                    currentId
                      ? t("invoicing.fiscal.reglas.wizard.guardar_cambios")
                      : t("invoicing.fiscal.reglas.wizard.guardar_btn")
                  }}
                </v-btn>
                <span
                  v-if="saved && !dirty"
                  class="text-body-2 text-success ml-3"
                  role="status"
                >
                  <v-icon icon="mdi-check-circle" size="16" />
                  {{ t("invoicing.fiscal.reglas.wizard.guardado") }}
                </span>
              </div>
            </v-stepper-window-item>

            <!-- 7. Vista previa (obligatoria) -->
            <v-stepper-window-item :value="7">
              <v-alert
                type="info"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                {{ t("invoicing.fiscal.reglas.wizard.preview_intro") }}
              </v-alert>
              <div
                v-if="!currentId || dirty"
                class="text-body-2 text-warning mb-2"
              >
                {{ t("invoicing.fiscal.reglas.wizard.preview_guarda_antes") }}
              </div>
              <div class="vig-grid">
                <v-text-field
                  v-model.number="pOpts.partner"
                  inputmode="numeric"
                  :label="t('invoicing.fiscal.reglas.wizard.preview_partner')"
                  :hint="
                    regla.id_partner
                      ? t(
                          'invoicing.fiscal.reglas.wizard.preview_partner_regla',
                        )
                      : t('invoicing.fiscal.reglas.wizard.preview_partner_hint')
                  "
                  persistent-hint
                  :disabled="regla.id_partner > 0"
                  density="comfortable"
                  variant="outlined"
                />
                <v-text-field
                  v-model.number="pOpts.cliente"
                  inputmode="numeric"
                  :label="t('invoicing.fiscal.reglas.wizard.preview_cliente')"
                  :disabled="regla.id_cliente > 0"
                  density="comfortable"
                  variant="outlined"
                />
                <v-text-field
                  v-model="pOpts.desde"
                  type="date"
                  :label="t('invoicing.fiscal.reglas.wizard.preview_desde')"
                  density="comfortable"
                  variant="outlined"
                />
                <v-text-field
                  v-model="pOpts.hasta"
                  type="date"
                  :label="t('invoicing.fiscal.reglas.wizard.preview_hasta')"
                  density="comfortable"
                  variant="outlined"
                />
                <v-text-field
                  v-model="pOpts.fecha"
                  type="date"
                  :label="t('invoicing.fiscal.reglas.wizard.preview_fecha')"
                  :hint="t('invoicing.fiscal.reglas.wizard.preview_fecha_hint')"
                  persistent-hint
                  density="comfortable"
                  variant="outlined"
                />
              </div>
              <v-btn
                color="primary"
                variant="tonal"
                :loading="previewing"
                :disabled="!currentId || dirty || previewing"
                prepend-icon="mdi-eye-check-outline"
                class="mb-3"
                @click="runPreview"
              >
                {{ t("invoicing.fiscal.reglas.wizard.preview_btn") }}
              </v-btn>
              <PreviewTable v-if="preview" :result="preview" />
            </v-stepper-window-item>

            <!-- 8. Activar / aprobar -->
            <v-stepper-window-item :value="8">
              <v-alert
                v-if="!preview && detalle?.estado !== 'PENDIENTE'"
                type="warning"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                {{ t("invoicing.fiscal.reglas.wizard.preview_obligatoria") }}
              </v-alert>
              <v-alert
                type="info"
                variant="tonal"
                density="compact"
                class="mb-3"
              >
                {{
                  store.dobleFirma
                    ? t("invoicing.fiscal.reglas.wizard.activar_doble")
                    : t("invoicing.fiscal.reglas.wizard.activar_simple")
                }}
              </v-alert>

              <v-alert
                v-if="activated"
                :type="activated.requiere_aprobacion ? 'warning' : 'success'"
                variant="tonal"
                density="compact"
                class="mb-3"
                role="status"
              >
                {{
                  activated.requiere_aprobacion
                    ? t("invoicing.fiscal.reglas.wizard.queda_pendiente")
                    : t("invoicing.fiscal.reglas.wizard.queda_activa")
                }}
              </v-alert>

              <template v-if="canActivate">
                <v-text-field
                  v-model="motivoActivar"
                  :label="t('invoicing.fiscal.motivo') + ' *'"
                  :hint="t('invoicing.fiscal.motivo_hint')"
                  persistent-hint
                  :error-messages="errs.motivo ? [errs.motivo] : []"
                  density="comfortable"
                  variant="outlined"
                  maxlength="255"
                />
                <v-btn
                  color="primary"
                  :loading="busy"
                  :disabled="!preview || dirty || !motivoActivar.trim()"
                  prepend-icon="mdi-check-decagram-outline"
                  @click="activate"
                >
                  {{
                    store.dobleFirma
                      ? t("invoicing.fiscal.reglas.wizard.activar_btn_doble")
                      : t("invoicing.fiscal.reglas.wizard.activar_btn")
                  }}
                </v-btn>
              </template>

              <template v-else-if="detalle?.estado === 'PENDIENTE'">
                <div class="text-body-2 mb-2">
                  {{
                    t("invoicing.fiscal.reglas.wizard.pendiente_info", {
                      user: detalle.firmas.primera_firma ?? "—",
                    })
                  }}
                </div>
                <v-text-field
                  v-model="motivoActivar"
                  :label="t('invoicing.fiscal.motivo') + ' *'"
                  :error-messages="errs.motivo ? [errs.motivo] : []"
                  density="comfortable"
                  variant="outlined"
                  maxlength="255"
                />
                <div class="d-flex ga-2">
                  <v-btn
                    color="primary"
                    :loading="busy"
                    :disabled="!motivoActivar.trim()"
                    prepend-icon="mdi-check-decagram-outline"
                    @click="approve"
                  >
                    {{ t("invoicing.fiscal.reglas.wizard.aprobar_btn") }}
                  </v-btn>
                  <v-btn
                    variant="outlined"
                    :loading="busy"
                    :disabled="!motivoActivar.trim()"
                    @click="reject"
                  >
                    {{ t("invoicing.fiscal.reglas.wizard.rechazar_btn") }}
                  </v-btn>
                </div>
              </template>
            </v-stepper-window-item>
          </v-stepper-window>
        </v-stepper>
      </v-card-text>

      <v-card-actions>
        <v-btn variant="text" :disabled="busy" @click="close">
          {{ t("common.cancel") }}
        </v-btn>
        <v-spacer />
        <v-btn
          variant="text"
          prepend-icon="mdi-chevron-left"
          :disabled="step <= 1 || busy"
          @click="step -= 1"
        >
          {{ t("common.back") }}
        </v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          append-icon="mdi-chevron-right"
          :disabled="step >= 8 || !canNext || busy"
          @click="step += 1"
        >
          {{ t("invoicing.fiscal.reglas.wizard.siguiente") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * RuleWizardDialog — asistente de regla fiscal en pasos (REGLAS_DINAMICAS
 * §3.8, F6b): etapa → ámbito → condición → acción → vigencia y prioridad →
 * guardar BORRADOR con motivo → vista previa OBLIGATORIA → activar (primera
 * firma) / aprobar (segundo operador).
 *
 * Por qué se guarda antes de la vista previa: la vista previa se registra
 * sobre la versión guardada de la regla (su huella) y `activate` exige el
 * token de esa versión; así lo que se activa es exactamente lo que se
 * previsualizó. Cualquier cambio posterior invalida la vista previa y el
 * asistente pide repetirla.
 *
 * Los parámetros de la acción se dibujan del esquema del catálogo
 * (ActionParamsForm) y la condición con el constructor visual
 * (ConditionBuilder, solo con los datos disponibles en la etapa). Los errores
 * 422 del backend se pintan en el campo que corresponde.
 *
 * Props:
 *   - `modelValue`: abierto o cerrado.
 *   - `ruleId`: regla a continuar (BORRADOR editable; PENDIENTE solo para
 *     aprobar o rechazar); null/ausente crea una nueva.
 *   - `today`: fecha de hoy (Y-m-d) para el inicio por defecto.
 * Emits: `update:modelValue`; `changed` (se guardó, activó, aprobó o
 * rechazó una regla: el listado debe recargarse).
 *
 * Ejemplo:
 *   <RuleWizardDialog v-model="open" :rule-id="editing" :today="hoy" @changed="reload" />
 */
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import { fieldErrors } from "../../../services/fiscConfig.service";
import {
  fiscReglasService,
  type PreviewResult,
  type ReglaAccion,
  type ReglaConflicto,
  type ReglaDetalle,
  type ReglaInput,
} from "../../../services/fiscReglas.service";
import { useFiscConfigStore } from "../../../stores/fiscConfig.store";
import { useFiscReglasStore } from "../../../stores/fiscReglas.store";
import ConditionBuilder from "../ConditionBuilder.vue";
import { summarizeCondition } from "../conditionModel";
import ActionParamsForm from "./ActionParamsForm.vue";
import ConflictsPanel from "./ConflictsPanel.vue";
import PreviewTable from "./PreviewTable.vue";
import ScopePicker from "./ScopePicker.vue";
import {
  ambitoText,
  cleanParams,
  defaultParams,
  emptyRegla,
  estadoColor,
  lastMonth,
  paramErrors,
} from "./reglasModel";

const props = defineProps<{
  modelValue: boolean;
  ruleId?: number | null;
  today: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "changed"): void;
}>();

const { t, te, locale } = useI18n();

/** Descripción de una acción en el idioma de la interfaz; la del catálogo si no hay traducción. */
function descAccion(a: { codigo: string; descripcion: string }): string {
  const key = `invoicing.fiscal.reglas.acciones_desc.${a.codigo}`;
  return te(key) ? t(key) : a.descripcion;
}
const store = useFiscReglasStore();
const config = useFiscConfigStore();

const STEP_KEYS = [
  "etapa",
  "ambito",
  "condicion",
  "accion",
  "vigencia",
  "guardar",
  "preview",
  "activar",
] as const;

const step = ref(1);
const loading = ref(false);
const busy = ref(false);
const previewing = ref(false);
const errorMessage = ref("");
const errs = ref<Record<string, string>>({});

const currentId = ref<number | null>(null);
const detalle = ref<ReglaDetalle | null>(null);
const regla = reactive(emptyRegla(props.today));
const params = ref<Record<string, unknown>>({});
const condJson = ref<string | null>(null);
const condValid = ref(true);
const codigo = ref("");
const motivoGuardar = ref("");
const motivoActivar = ref("");
const saved = ref(false);
const savedSnapshot = ref("");
const preview = ref<PreviewResult | null>(null);
const activated = ref<{ estado: string; requiere_aprobacion: boolean } | null>(
  null,
);
const pOpts = reactive({
  partner: 0,
  cliente: 0,
  desde: "",
  hasta: "",
  fecha: "",
});
const conflictos = ref<ReglaConflicto[]>([]);
const conflictosLoading = ref(false);
const conflictosError = ref<string | null>(null);

const stepItems = computed(() =>
  STEP_KEYS.map((k, i) => ({
    title: t(`invoicing.fiscal.reglas.wizard.steps.${k}`),
    value: i + 1,
  })),
);

/** Una regla que ya no es BORRADOR no se edita (PENDIENTE solo se aprueba o rechaza). */
const locked = computed(
  () => !!detalle.value && detalle.value.estado !== "BORRADOR",
);
const accionActual = computed(() => store.accion(regla.accion));
const paramErrs = computed(() => paramErrors(errs.value));
const etapasConReglas = computed(() =>
  (store.catalogo?.etapas ?? []).filter(
    (e) => store.accionesDe(e.etapa).length > 0,
  ),
);
const accionItems = computed(() =>
  store.accionesDe(regla.etapa).map((a) => ({
    title: `${nombreAccion(a.codigo)} — ${t(`invoicing.fiscal.reglas.politica.${a.politica}`)}`,
    value: a.codigo,
  })),
);
const ambito = computed(() => ({
  iso_paese: regla.iso_paese,
  id_partner: regla.id_partner,
  id_servizio: regla.id_servizio,
  id_cliente: regla.id_cliente,
}));
const etapaNombre = computed(() => {
  const e = store.catalogo?.etapas.find((x) => x.etapa === regla.etapa);
  return e ? `${e.orden}. ${stageName(e)}` : regla.etapa;
});
const condResumen = computed(() => {
  if (!condJson.value) return t("invoicing.fiscal.reglas.wizard.siempre");
  return (
    summarizeCondition(condJson.value, config.catalogo, {
      t,
      lang: String(locale.value),
    }) || condJson.value
  );
});
const paramsResumen = computed(() => {
  const p = cleanParams(accionActual.value, params.value);
  return Object.keys(p).length ? JSON.stringify(p) : "";
});

/** Contenido que se guarda; sirve para saber si hay cambios sin guardar. */
function payload(): ReglaInput {
  return {
    etapa: regla.etapa,
    accion: regla.accion,
    parametros: cleanParams(accionActual.value, params.value),
    condicion: condJson.value ?? "",
    iso_paese: regla.iso_paese,
    id_partner: regla.id_partner,
    id_servizio: regla.id_servizio,
    id_cliente: regla.id_cliente,
    prioridad: regla.prioridad,
    data_inizio: regla.data_inizio,
    data_fine: regla.data_fine ?? "",
    nombre: regla.nombre,
    descrizione: regla.descrizione,
    rif_normativo: regla.rif_normativo,
  };
}

const dirty = computed(() => JSON.stringify(payload()) !== savedSnapshot.value);
const canSave = computed(
  () =>
    !busy.value &&
    !!regla.etapa &&
    !!regla.accion &&
    !!regla.data_inizio &&
    condValid.value &&
    motivoGuardar.value.trim() !== "" &&
    (dirty.value || !currentId.value),
);
const canActivate = computed(
  () => !locked.value && !!currentId.value && !activated.value,
);
const canNext = computed(() => {
  switch (step.value) {
    case 1:
      return !!regla.etapa;
    case 3:
      return condValid.value;
    case 4:
      return !!regla.accion;
    case 5:
      return !!regla.data_inizio;
    case 6:
      return locked.value || (!!currentId.value && !dirty.value);
    case 7:
      return locked.value || !!preview.value;
    default:
      return true;
  }
});

function stageName(e: {
  etapa: string;
  etiquetas: Record<string, string>;
}): string {
  return e.etiquetas[String(locale.value)] ?? e.etiquetas.en ?? e.etapa;
}

function accionesTexto(etapa: string): string {
  return store
    .accionesDe(etapa)
    .map((a) => nombreAccion(a.codigo))
    .join(", ");
}

function setEtapa(etapa: string): void {
  if (regla.etapa === etapa) return;
  regla.etapa = etapa;
  // La condición y la acción dependen de la etapa: se vuelve a elegir la acción.
  regla.accion = "";
  params.value = {};
}

/** Objetivos agrupados por lo que el usuario quiere conseguir; dentro, en el orden de OBJETIVOS. */
const OBJETIVOS: Record<string, string[]> = {
  importes: [
    "AJUSTAR_PORCENTAJE",
    "CARGO_FIJO",
    "EXCLUIR_DE_BASE",
    "INCLUIR_EN_BASE",
  ],
  impuestos: [
    "EXENCION",
    "INVERSION_SUJETO_PASIVO",
    "FIJAR_TIPO",
    "ESIGIBILIDAD",
    "BOLLO",
    "RETENCION",
  ],
  textos: ["MENCION"],
  controles: ["REQUERIR_DATO", "RETENER_ENVIO", "BLOQUEAR"],
};

const objetivos = computed(() => {
  const todas = (store.catalogo?.acciones ?? []).filter((a) => a.crea_regla);
  const usadas = new Set<string>();
  const grupos = Object.entries(OBJETIVOS).map(([grupo, codigos]) => {
    const acciones = codigos
      .map((c) => todas.find((a) => a.codigo === c))
      .filter((a): a is ReglaAccion => !!a);
    acciones.forEach((a) => usadas.add(a.codigo));
    return { grupo, acciones };
  });
  // Acciones nuevas del catálogo que aún no tienen grupo.
  const resto = todas.filter((a) => !usadas.has(a.codigo));
  if (resto.length) grupos.push({ grupo: "otros", acciones: resto });
  return grupos.filter((g) => g.acciones.length > 0);
});

/** Nombre de negocio de una acción; el código si no hay traducción. */
function nombreAccion(codigo: string): string {
  const key = `invoicing.fiscal.reglas.acciones_nombre.${codigo}`;
  return te(key) ? t(key) : codigo;
}

/** Elegir un objetivo fija la etapa y la acción (la etapa la decide el sistema). */
function elegirObjetivo(a: ReglaAccion): void {
  setEtapa(a.etapa);
  if (regla.accion !== a.codigo) setAccion(a.codigo);
}

function setAccion(codigo: string): void {
  regla.accion = codigo;
  params.value = defaultParams(store.accion(codigo));
}

function setAmbito(a: {
  iso_paese: string;
  id_partner: number;
  id_servizio: number;
  id_cliente: number;
}): void {
  Object.assign(regla, a);
}

function reset(): void {
  step.value = 1;
  errorMessage.value = "";
  errs.value = {};
  currentId.value = null;
  detalle.value = null;
  Object.assign(regla, emptyRegla(props.today));
  params.value = {};
  condJson.value = null;
  condValid.value = true;
  codigo.value = "";
  motivoGuardar.value = "";
  motivoActivar.value = "";
  saved.value = false;
  savedSnapshot.value = "";
  preview.value = null;
  activated.value = null;
  const [d, h] = lastMonth();
  Object.assign(pOpts, {
    partner: 0,
    cliente: 0,
    desde: d,
    hasta: h,
    fecha: "",
  });
  conflictos.value = [];
  conflictosError.value = null;
}

/** Carga una regla guardada en el formulario. */
async function loadRule(id: number): Promise<void> {
  loading.value = true;
  try {
    const r = await fiscReglasService.row(id);
    detalle.value = r;
    currentId.value = id;
    Object.assign(regla, {
      etapa: r.etapa,
      accion: r.accion,
      iso_paese: r.iso_paese ?? "",
      id_partner: Number(r.id_partner) || 0,
      id_servizio: Number(r.id_servizio) || 0,
      id_cliente: Number(r.id_cliente) || 0,
      prioridad: Number(r.prioridad) || 0,
      data_inizio: r.data_inizio,
      data_fine: r.data_fine ?? "",
      nombre: r.nombre ?? "",
      descrizione: r.descrizione ?? "",
      rif_normativo: r.rif_normativo ?? "",
    });
    params.value = { ...defaultParams(store.accion(r.accion)), ...r.params };
    condJson.value =
      r.condicion_json && r.condicion_json !== "" ? r.condicion_json : null;
    pOpts.partner = regla.id_partner;
    pOpts.cliente = regla.id_cliente;
    savedSnapshot.value = JSON.stringify(payload());
    saved.value = true;
    // Una pendiente solo se aprueba o rechaza: va directa al último paso.
    step.value = r.estado === "PENDIENTE" ? 8 : r.estado === "BORRADOR" ? 1 : 6;
  } catch (e) {
    errorMessage.value = toUserMessage(e, String(e));
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    reset();
    await Promise.all([store.loadCatalogo(), config.load()]);
    if (props.ruleId) await loadRule(props.ruleId);
  },
);

// Cambiar la regla invalida la vista previa hecha.
watch(dirty, (d) => {
  if (d) {
    preview.value = null;
    activated.value = null;
  }
});

// El partner y el cliente de la vista previa siguen al ámbito: si este los fija,
// los campos están bloqueados y deben mostrar el valor actual, no el de la carga.
watch(
  () => [regla.id_partner, regla.id_cliente] as const,
  ([partner, cliente]) => {
    pOpts.partner = partner;
    pOpts.cliente = cliente;
  },
);

// Los conflictos se consultan al entrar en vigencia o en guardar (la regla en construcción).
watch(step, (s) => {
  if (
    (s === 5 || s === 6) &&
    regla.etapa &&
    regla.accion &&
    regla.data_inizio
  ) {
    void loadConflictos();
  }
});

async function loadConflictos(): Promise<void> {
  conflictosLoading.value = true;
  conflictosError.value = null;
  try {
    const res =
      currentId.value && !dirty.value
        ? await fiscReglasService.conflictos(currentId.value)
        : await fiscReglasService.conflictosDe(payload());
    conflictos.value = res.conflictos;
  } catch (e) {
    conflictos.value = [];
    conflictosError.value = toUserMessage(e, String(e));
  } finally {
    conflictosLoading.value = false;
  }
}

/** Pinta el error del backend: mensaje general y campos (el paso donde está el campo se abre). */
function showError(e: unknown): void {
  errs.value = fieldErrors(e);
  errorMessage.value = toUserMessage(e, String(e));
  const k = Object.keys(errs.value);
  if (k.some((x) => x === "etapa")) step.value = 1;
  else if (
    k.some((x) =>
      ["iso_paese", "id_partner", "id_servizio", "id_cliente"].includes(x),
    )
  )
    step.value = 2;
  else if (k.includes("condicion")) step.value = 3;
  else if (k.some((x) => x === "accion" || x.startsWith("parametros")))
    step.value = 4;
  else if (
    k.some((x) =>
      [
        "data_inizio",
        "data_fine",
        "prioridad",
        "nombre",
        "codigo",
        "rif_normativo",
      ].includes(x),
    )
  )
    step.value = 5;
}

async function save(): Promise<void> {
  busy.value = true;
  errs.value = {};
  errorMessage.value = "";
  try {
    const data = payload();
    if (currentId.value) {
      await fiscReglasService.update(
        currentId.value,
        data,
        motivoGuardar.value,
      );
    } else {
      if (codigo.value.trim()) data.codigo = codigo.value.trim();
      const res = await fiscReglasService.create(data, motivoGuardar.value);
      currentId.value = res.id;
    }
    savedSnapshot.value = JSON.stringify(payload());
    saved.value = true;
    motivoGuardar.value = "";
    detalle.value = await fiscReglasService.row(currentId.value as number);
    emit("changed");
    void loadConflictos();
  } catch (e) {
    showError(e);
  } finally {
    busy.value = false;
  }
}

async function runPreview(): Promise<void> {
  if (!currentId.value) return;
  previewing.value = true;
  errorMessage.value = "";
  try {
    preview.value = await fiscReglasService.preview(currentId.value, {
      partner: pOpts.partner || undefined,
      cliente: pOpts.cliente || undefined,
      desde: pOpts.desde || undefined,
      hasta: pOpts.hasta || undefined,
      fecha: pOpts.fecha || undefined,
    });
    detalle.value = await fiscReglasService.row(currentId.value);
  } catch (e) {
    preview.value = null;
    showError(e);
  } finally {
    previewing.value = false;
  }
}

async function activate(): Promise<void> {
  if (!currentId.value || !preview.value) return;
  busy.value = true;
  errs.value = {};
  errorMessage.value = "";
  try {
    activated.value = await fiscReglasService.activate(
      currentId.value,
      preview.value.token,
      motivoActivar.value,
    );
    motivoActivar.value = "";
    detalle.value = await fiscReglasService.row(currentId.value);
    emit("changed");
  } catch (e) {
    showError(e);
  } finally {
    busy.value = false;
  }
}

async function approve(): Promise<void> {
  if (!currentId.value) return;
  busy.value = true;
  errs.value = {};
  errorMessage.value = "";
  try {
    await fiscReglasService.approve(currentId.value, motivoActivar.value);
    emit("changed");
    emit("update:modelValue", false);
  } catch (e) {
    showError(e);
  } finally {
    busy.value = false;
  }
}

async function reject(): Promise<void> {
  if (!currentId.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    await fiscReglasService.reject(currentId.value, motivoActivar.value);
    emit("changed");
    emit("update:modelValue", false);
  } catch (e) {
    showError(e);
  } finally {
    busy.value = false;
  }
}

function close(): void {
  emit("update:modelValue", false);
}
</script>

<style scoped>
.obj-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.obj-card {
  cursor: pointer;
}
.obj-card :deep(.v-card-title) {
  white-space: normal;
  line-height: 1.3;
}
.vig-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 4px 16px;
}

.summary {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
}

.summary dt {
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.summary dd {
  margin: 0;
}

.wizard-stepper {
  box-shadow: none;
}
</style>
