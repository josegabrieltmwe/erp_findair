<template>
  <v-dialog
    :model-value="modelValue"
    max-width="820"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card v-if="row">
      <v-card-title class="text-subtitle-1 d-flex align-center ga-2">
        <v-icon icon="mdi-calendar-arrow-right" color="primary" />
        {{ t("invoicing.fiscal.change.title") }}
      </v-card-title>
      <v-card-text>
        <v-alert
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3 text-body-2"
        >
          {{ t("invoicing.fiscal.change.intro") }}
        </v-alert>

        <!-- Identidad de la regla: no cambia -->
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t("invoicing.fiscal.change.scope") }}
        </div>
        <div class="d-flex flex-wrap ga-1 mb-3">
          <v-chip
            v-for="key in scopeFields"
            :key="key"
            size="small"
            variant="outlined"
          >
            {{ t(`invoicing.fiscal.field.${key}`) }}:
            <strong class="ml-1">{{ scopeText(key) }}</strong>
          </v-chip>
        </div>

        <div class="fisc-form-grid">
          <v-text-field
            v-model="desde"
            type="date"
            :label="t('invoicing.fiscal.change.desde') + ' *'"
            :hint="t('invoicing.fiscal.change.desde_hint')"
            persistent-hint
            density="compact"
          />
          <v-text-field
            v-model="hasta"
            type="date"
            :label="t('invoicing.fiscal.change.hasta')"
            :hint="t('invoicing.fiscal.change.hasta_hint')"
            persistent-hint
            density="compact"
          />
        </div>

        <div class="text-caption text-medium-emphasis mt-3 mb-1">
          {{ t("invoicing.fiscal.change.new_values") }}
        </div>
        <div class="fisc-form-grid">
          <div
            v-for="field in editable"
            :key="field.key"
            :class="{ 'fisc-form-wide': field.type === 'textarea' }"
          >
            <FiscFieldInput
              v-model="form[field.key]"
              :field="field"
              :tabla="tabla"
              :error="fieldErrs[field.key]"
            />
          </div>
        </div>

        <!-- Vista previa: fila que se cierra y fila nueva -->
        <v-card
          v-if="preview"
          variant="outlined"
          class="mt-3 pa-3"
          :color="preview.ok ? 'success' : 'error'"
        >
          <div class="fisc-preview">
            <div>
              <div class="text-overline">
                {{
                  t("invoicing.fiscal.change.current_row", {
                    id: preview.cierre.id,
                  })
                }}
              </div>
              <div class="text-body-2">
                {{ summary(preview.actual) }}
              </div>
              <div class="text-body-2">
                {{ preview.actual.data_inizio }} →
                <span v-if="preview.cierre.se_cierra">
                  <s class="text-medium-emphasis">{{
                    preview.cierre.data_fine_actual ??
                    t("invoicing.fiscal.open")
                  }}</s>
                  <strong class="ml-1">{{
                    preview.cierre.data_fine_nueva
                  }}</strong>
                </span>
                <span v-else>{{
                  preview.cierre.data_fine_actual ?? t("invoicing.fiscal.open")
                }}</span>
              </div>
            </div>
            <v-icon
              icon="mdi-arrow-right-bold"
              size="28"
              class="align-self-center"
            />
            <div>
              <div class="text-overline">
                {{ t("invoicing.fiscal.change.new_row") }}
              </div>
              <div class="text-body-2">
                <strong>{{ summary(preview.nueva) }}</strong>
              </div>
              <div class="text-body-2">
                {{ String(preview.nueva.data_inizio ?? "") }} →
                {{
                  (preview.nueva.data_fine as string | null) ??
                  t("invoicing.fiscal.open")
                }}
              </div>
            </div>
          </div>

          <v-table
            v-if="Object.keys(preview.cambios).length"
            density="compact"
            class="mt-2 fisc-changes"
          >
            <tbody>
              <tr v-for="(c, key) in preview.cambios" :key="key">
                <td class="text-medium-emphasis">
                  {{ t(`invoicing.fiscal.field.${key}`) }}
                </td>
                <td>{{ show(c.antes) }}</td>
                <td><v-icon icon="mdi-arrow-right" size="14" /></td>
                <td>
                  <strong>{{ show(c.despues) }}</strong>
                </td>
              </tr>
            </tbody>
          </v-table>

          <div v-if="preview.ultima_aplicacion" class="text-caption mt-2">
            {{
              t("invoicing.fiscal.change.last_applied", {
                fecha: preview.ultima_aplicacion,
              })
            }}
          </div>
          <v-alert
            v-for="(err, i) in preview.errores"
            :key="`e${i}`"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ err.mensaje }}
            <span v-if="err.solapes?.length">
              ({{
                t("invoicing.fiscal.change.overlaps", {
                  ids: err.solapes.map((s) => `#${s.id}`).join(", "),
                })
              }})
            </span>
          </v-alert>
          <v-alert
            v-for="(aviso, i) in preview.avisos"
            :key="`a${i}`"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            {{ aviso }}
          </v-alert>
        </v-card>

        <v-text-field
          v-model="motivo"
          class="mt-3"
          :label="t('invoicing.fiscal.motivo') + ' *'"
          :hint="t('invoicing.fiscal.motivo_hint')"
          persistent-hint
          density="compact"
        />
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{ errorMessage }}
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ t("common.cancel") }}
        </v-btn>
        <v-btn
          variant="tonal"
          prepend-icon="mdi-eye-outline"
          :loading="previewing"
          :disabled="!desde"
          @click="runPreview"
        >
          {{ t("invoicing.fiscal.change.preview") }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="busy"
          :disabled="!canConfirm"
          @click="confirm"
        >
          {{ t("invoicing.fiscal.change.confirm") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fieldErrors,
  fiscConfigService,
  type ChangePreview,
  type FiscRow,
  type FiscTabla,
} from "../../services/fiscConfig.service";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";
import FiscFieldInput from "./FiscFieldInput.vue";
import {
  SCOPE_FIELDS,
  TABLE_FIELDS,
  cellText,
  num,
  valueSummary,
} from "./fiscFields";

const props = defineProps<{
  modelValue: boolean;
  tabla: FiscTabla;
  row: FiscRow | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved", id: number): void;
}>();

const { t } = useI18n();
const store = useFiscConfigStore();

const scopeFields = computed(() => SCOPE_FIELDS[props.tabla]);
const editable = computed(() =>
  TABLE_FIELDS[props.tabla].filter(
    (f) =>
      !scopeFields.value.includes(f.key) &&
      f.key !== "data_inizio" &&
      f.key !== "data_fine",
  ),
);

const form = reactive<Record<string, string | number | null>>({});
const desde = ref("");
const hasta = ref("");
const motivo = ref("");
const preview = ref<ChangePreview | null>(null);
const previewKey = ref("");
const previewing = ref(false);
const busy = ref(false);
const errorMessage = ref("");
const fieldErrs = ref<Record<string, string>>({});

/** Primer día del mes siguiente: fecha habitual de un cambio de tipo. */
function nextMonthStart(today: string): string {
  const [y, m] = today.split("-").map(Number);
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

watch(
  () => [props.modelValue, props.row] as const,
  ([open, row]) => {
    if (!open || !row) return;
    for (const k of Object.keys(form)) delete form[k];
    for (const f of editable.value) {
      const v = row[f.key];
      form[f.key] =
        f.type === "decimal"
          ? num(v)
          : v === null || v === undefined
            ? ""
            : (v as string | number);
    }
    desde.value = nextMonthStart(store.hoy);
    hasta.value = "";
    motivo.value = "";
    preview.value = null;
    previewKey.value = "";
    errorMessage.value = "";
    fieldErrs.value = {};
  },
  { immediate: true },
);

function changedData(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of editable.value) {
    data[f.key] = form[f.key] === null ? "" : form[f.key];
  }
  if (hasta.value) data.data_fine = hasta.value;
  return data;
}

const currentKey = computed(() =>
  JSON.stringify([desde.value, hasta.value, { ...form }]),
);

const canConfirm = computed(
  () =>
    !!preview.value?.ok &&
    previewKey.value === currentKey.value &&
    motivo.value.trim() !== "",
);

async function runPreview(): Promise<void> {
  if (!props.row) return;
  previewing.value = true;
  errorMessage.value = "";
  fieldErrs.value = {};
  try {
    preview.value = await fiscConfigService.preview(
      props.tabla,
      Number(props.row.id),
      changedData(),
      desde.value,
    );
    previewKey.value = currentKey.value;
    for (const err of preview.value.errores) {
      if (err.fields) Object.assign(fieldErrs.value, err.fields);
    }
  } catch (e) {
    preview.value = null;
    fieldErrs.value = fieldErrors(e);
    errorMessage.value = toUserMessage(e, String(e));
  } finally {
    previewing.value = false;
  }
}

async function confirm(): Promise<void> {
  if (!props.row) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    const res = await fiscConfigService.closeAndCreate(
      props.tabla,
      Number(props.row.id),
      changedData(),
      desde.value,
      motivo.value,
    );
    emit("saved", res.id);
    emit("update:modelValue", false);
  } catch (e) {
    fieldErrs.value = fieldErrors(e);
    errorMessage.value = toUserMessage(e, String(e));
  } finally {
    busy.value = false;
  }
}

function scopeText(key: string): string {
  if (!props.row) return "";
  if (key === "id_voce") return store.voceCode(props.row.id_voce);
  return cellText(key, props.row[key], t("invoicing.fiscal.all")) || "—";
}

function summary(r: Record<string, unknown>): string {
  return valueSummary(props.tabla, r as FiscRow) || "—";
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}
</script>

<style scoped>
.fisc-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 4px 12px;
}

.fisc-form-wide {
  grid-column: 1 / -1;
}

.fisc-preview {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 12px;
}

.fisc-changes td {
  padding: 2px 8px !important;
}
</style>
