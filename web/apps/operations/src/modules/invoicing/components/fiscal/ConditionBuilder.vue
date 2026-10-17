<template>
  <div class="cond-builder">
    <v-progress-linear v-if="!catalogo && !loadFailed" indeterminate />
    <v-alert
      v-else-if="!catalogo"
      type="warning"
      variant="tonal"
      density="compact"
    >
      {{ t("invoicing.fiscal.cond.catalog_error") }}
    </v-alert>

    <template v-else-if="root">
      <div class="text-body-2 mb-1">
        {{ t("invoicing.fiscal.cond.intro") }}
        <span v-if="stage" class="text-medium-emphasis">
          ({{ t("invoicing.fiscal.cond.stage_hint", { etapa: stageLabel }) }})
        </span>
      </div>

      <!-- Atajos con equivalente en filas -->
      <div class="mb-2">
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t("invoicing.fiscal.cond.atajos") }}
        </div>
        <div class="d-flex flex-wrap ga-1">
          <span
            v-for="code in ATAJO_CHIPS"
            :key="code"
            :title="chipTitle(code)"
          >
            <v-chip
              size="small"
              variant="tonal"
              :disabled="readonly || !chipUsable(code)"
              :aria-label="chipTitle(code)"
              role="button"
              tabindex="0"
              @click="addAtajo(code)"
              @keydown.enter.prevent="addAtajo(code)"
            >
              {{ code }}
            </v-chip>
          </span>
        </div>
        <div class="text-caption text-medium-emphasis mt-1">
          {{ t("invoicing.fiscal.cond.atajos_hint") }}
        </div>
      </div>

      <!-- Grupo raíz -->
      <v-sheet border rounded class="pa-3">
        <div class="d-flex align-center flex-wrap ga-2 mb-1">
          <span class="text-body-2">{{
            t("invoicing.fiscal.cond.se_cumplen")
          }}</span>
          <v-btn-toggle
            :model-value="root.mode"
            density="compact"
            variant="outlined"
            mandatory
            divided
            :disabled="readonly"
            :aria-label="t('invoicing.fiscal.cond.modo')"
            @update:model-value="(m: GroupMode) => (root!.mode = m)"
          >
            <v-btn value="todas" size="small">{{
              t("invoicing.fiscal.cond.todas")
            }}</v-btn>
            <v-btn value="cualquiera" size="small">{{
              t("invoicing.fiscal.cond.cualquiera")
            }}</v-btn>
          </v-btn-toggle>
          <span class="text-body-2">{{
            t("invoicing.fiscal.cond.estas")
          }}</span>
        </div>

        <div
          v-if="root.items.length === 0"
          class="text-body-2 text-medium-emphasis py-2"
        >
          {{ t("invoicing.fiscal.cond.vacia") }}
        </div>

        <template v-for="(item, i) in root.items" :key="i">
          <ConditionLeafRow
            v-if="item.kind === 'leaf'"
            :model-value="item"
            :catalogo="catalogo"
            :options="options"
            :has-error="errorPaths.has(String(i + 1))"
            :readonly="readonly"
            @update:model-value="(v: CondLeaf) => (root!.items[i] = v)"
            @remove="root!.items.splice(i, 1)"
          />
          <v-sheet
            v-else
            border
            rounded
            class="pa-2 my-2 cond-sub"
            role="group"
            :aria-label="t('invoicing.fiscal.cond.subgrupo')"
          >
            <div class="d-flex align-center flex-wrap ga-2 mb-1">
              <span class="text-body-2">{{
                t("invoicing.fiscal.cond.se_cumplen")
              }}</span>
              <v-btn-toggle
                :model-value="item.mode"
                density="compact"
                variant="outlined"
                mandatory
                divided
                :disabled="readonly"
                :aria-label="t('invoicing.fiscal.cond.modo')"
                @update:model-value="(m: GroupMode) => (item.mode = m)"
              >
                <v-btn value="todas" size="small">{{
                  t("invoicing.fiscal.cond.todas")
                }}</v-btn>
                <v-btn value="cualquiera" size="small">{{
                  t("invoicing.fiscal.cond.cualquiera")
                }}</v-btn>
              </v-btn-toggle>
              <span class="text-body-2">{{
                t("invoicing.fiscal.cond.estas")
              }}</span>
              <v-spacer />
              <v-btn
                v-if="!readonly"
                icon="mdi-delete-outline"
                size="x-small"
                variant="text"
                :title="t('invoicing.fiscal.cond.remove_group')"
                :aria-label="t('invoicing.fiscal.cond.remove_group')"
                @click="root!.items.splice(i, 1)"
              />
            </div>
            <template v-for="(sub, j) in item.items" :key="j">
              <ConditionLeafRow
                v-if="sub.kind === 'leaf'"
                :model-value="sub"
                :catalogo="catalogo"
                :options="options"
                :has-error="errorPaths.has(`${i + 1}.${j + 1}`)"
                :readonly="readonly"
                @update:model-value="(v: CondLeaf) => (item.items[j] = v)"
                @remove="item.items.splice(j, 1)"
              />
            </template>
            <v-btn
              v-if="!readonly"
              size="small"
              variant="text"
              prepend-icon="mdi-plus"
              @click="addLeaf(item)"
            >
              {{ t("invoicing.fiscal.cond.add_row") }}
            </v-btn>
          </v-sheet>
        </template>

        <div v-if="!readonly" class="d-flex flex-wrap ga-2 mt-1">
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-plus"
            :disabled="options.length === 0"
            @click="addLeaf(root!)"
          >
            {{ t("invoicing.fiscal.cond.add_row") }}
          </v-btn>
          <v-btn
            v-if="catalogo.max_anidamiento >= 2"
            size="small"
            variant="text"
            prepend-icon="mdi-plus-box-multiple-outline"
            :disabled="options.length === 0"
            @click="addGroup"
          >
            {{ t("invoicing.fiscal.cond.add_group") }}
          </v-btn>
        </div>
      </v-sheet>

      <!-- Errores, resumen y JSON -->
      <v-alert
        v-if="errors.length"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-2"
        role="alert"
      >
        <ul class="pl-4">
          <li v-for="(e, k) in errors" :key="k">{{ errorText(e) }}</li>
        </ul>
      </v-alert>
      <div v-if="summary" class="text-body-2 mt-2">
        <v-icon icon="mdi-text-box-outline" size="16" class="mr-1" />
        <strong>{{ t("invoicing.fiscal.cond.resumen") }}:</strong>
        {{ summary }}
      </div>
      <v-expansion-panels class="mt-2" variant="accordion">
        <v-expansion-panel>
          <v-expansion-panel-title class="text-body-2">
            {{ t("invoicing.fiscal.cond.ver_json") }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <pre class="cond-json">{{ prettyJson }}</pre>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>

    <!-- JSON que el constructor no sabe leer -->
    <v-alert v-else type="warning" variant="tonal" density="compact">
      {{ t("invoicing.fiscal.cond.not_editable") }}
      <pre class="cond-json mt-2">{{ modelValue }}</pre>
    </v-alert>
  </div>
</template>

<script setup lang="ts">
/**
 * ConditionBuilder — constructor visual de condiciones de las reglas fiscales
 * (REGLAS_DINAMICAS §3.3 y §3.8). Edita el JSON de `condicion_json`: un grupo
 * raíz «todas» (Y) o «cualquiera» (O) con filas «dato · operador · valor» y,
 * como máximo, un nivel de subgrupo (anidamiento <= 2).
 *
 * Solo ofrece los datos disponibles en la etapa de la regla (`stage`), valida
 * en cliente con los tipos y operadores del catálogo (`GET ?op=catalogo`) y
 * muestra el resumen legible y el JSON resultante. El backend valida igualmente
 * al guardar. Los atajos sin equivalente (NACIONAL, INTRA_UE_*, EXTRA_UE,
 * RUTA:…) no se pueden mezclar con el JSON: se escriben en el campo de texto
 * `condicion`; los demás se insertan como filas equivalentes.
 *
 * Props:
 *   - modelValue: texto de `condicion_json` (null o vacío = sin condición JSON).
 *   - stage: etapa de la regla (IMPUESTOS, RECARGOS, FACTURA, VALIDACION…);
 *     null = se ofrecen todos los datos.
 *   - readonly: solo lectura.
 * Emits:
 *   - update:modelValue(string|null): JSON canónico del árbol, o null si no hay filas.
 *   - update:valid(boolean): false mientras haya errores de validación en cliente.
 *
 * Ejemplo:
 *   <ConditionBuilder v-model="form.condicion_json" stage="IMPUESTOS"
 *                     @update:valid="jsonOk = $event" />
 */
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";
import ConditionLeafRow from "./ConditionLeafRow.vue";
import {
  ATAJO_CHIPS,
  ATAJO_ROWS,
  countLeaves,
  datoOptions,
  explainAtajo,
  newGroup,
  newLeaf,
  parseCondition,
  serializeCondition,
  summarizeCondition,
  validateCondition,
  type CondError,
  type CondGroup,
  type CondLeaf,
  type GroupMode,
} from "./conditionModel";

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    stage?: string | null;
    readonly?: boolean;
  }>(),
  { stage: null, readonly: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", v: string | null): void;
  (e: "update:valid", v: boolean): void;
}>();

const { t, locale } = useI18n();
const store = useFiscConfigStore();

const catalogo = computed(() => store.catalogo);
const loadFailed = ref(false);
const root = ref<CondGroup | null>(parseCondition(props.modelValue));
let lastEmitted: string | null = props.modelValue;

const lang = computed(() => String(locale.value));
const options = computed(() =>
  catalogo.value ? datoOptions(catalogo.value, props.stage, lang.value, t) : [],
);
const stageLabel = computed(() => {
  const e = catalogo.value?.etapas.find((x) => x.etapa === props.stage);
  return e ? (e.etiquetas[lang.value] ?? e.etiquetas.en ?? e.etapa) : "";
});

const errors = computed<CondError[]>(() =>
  catalogo.value && root.value
    ? validateCondition(root.value, catalogo.value, props.stage)
    : [],
);
const errorPaths = computed(() => new Set(errors.value.map((e) => e.path)));
const json = computed(() =>
  root.value ? serializeCondition(root.value) : null,
);
const summary = computed(() =>
  json.value
    ? summarizeCondition(json.value, catalogo.value, { t, lang: lang.value })
    : "",
);
const prettyJson = computed(() =>
  json.value ? JSON.stringify(JSON.parse(json.value), null, 2) : "{}",
);

function errorText(e: CondError): string {
  return t(`invoicing.fiscal.cond.err.${e.code}`, {
    ...(e.params ?? {}),
    path: e.path,
  });
}

// El árbol es la fuente de verdad: cada cambio emite el JSON; un cambio de
// fuera (otro valor de v-model) lo vuelve a leer.
watch(
  root,
  () => {
    if (!root.value) return;
    const next = json.value;
    if (next !== lastEmitted) {
      lastEmitted = next;
      emit("update:modelValue", next);
    }
  },
  { deep: true },
);

watch(
  () => props.modelValue,
  (v) => {
    if (v === lastEmitted) return;
    lastEmitted = v;
    root.value = parseCondition(v);
  },
);

watch(
  [errors, root],
  () => emit("update:valid", errors.value.length === 0 && root.value !== null),
  { immediate: true },
);

function addLeaf(group: CondGroup): void {
  const first = options.value[0];
  if (first) group.items.push(newLeaf(first));
}

function addGroup(): void {
  if (!root.value) return;
  const g = newGroup("cualquiera");
  addLeaf(g);
  root.value.items.push(g);
}

function chipUsable(code: string): boolean {
  const rows = ATAJO_ROWS[code];
  if (!rows) return false;
  return rows.every((r) => options.value.some((o) => o.value === r.dato));
}

function chipTitle(code: string): string {
  const text = explainAtajo(code, t);
  if (!ATAJO_ROWS[code]) {
    return `${text} — ${t("invoicing.fiscal.cond.atajo_solo_texto")}`;
  }
  if (!chipUsable(code)) {
    return `${text} — ${t("invoicing.fiscal.cond.atajo_no_etapa")}`;
  }
  return `${text} — ${t("invoicing.fiscal.cond.atajo_insertar")}`;
}

/** Inserta las filas equivalentes del atajo en el grupo raíz. */
function addAtajo(code: string): void {
  const rows = ATAJO_ROWS[code];
  if (!rows || !root.value || props.readonly || !chipUsable(code)) return;
  for (const r of rows) {
    root.value.items.push({ kind: "leaf", ...r });
  }
}

onMounted(async () => {
  await store.loadCatalogo();
  loadFailed.value = !store.catalogo;
});

defineExpose({ countLeaves: () => (root.value ? countLeaves(root.value) : 0) });
</script>

<style scoped>
.cond-sub {
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.cond-json {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
