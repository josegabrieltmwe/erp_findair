<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1 d-flex align-center">
        <v-icon icon="mdi-counter" size="20" class="me-2" />
        {{
          isEdit
            ? t("invoicing.numbering.dialog.edit_title")
            : t("invoicing.numbering.dialog.new_title")
        }}
      </v-card-title>

      <v-card-text>
        <div class="d-flex ga-3 mb-3">
          <v-text-field
            v-model="form.codice"
            :label="t('invoicing.numbering.field.codice')"
            :hint="t('invoicing.numbering.field.codice_hint')"
            :disabled="isEdit"
            persistent-hint
            maxlength="30"
            style="max-width: 220px"
          />
          <v-text-field
            v-model="form.label"
            :label="t('invoicing.numbering.field.label')"
            maxlength="100"
          />
        </div>

        <div class="d-flex ga-3 mb-3">
          <v-select
            v-model="form.tipo_fattura"
            :items="tipoItems"
            :label="t('invoicing.numbering.field.tipo')"
            style="max-width: 220px"
          />
          <v-select
            v-model="form.reinicio"
            :items="reinicioItems"
            :label="t('invoicing.numbering.field.reinicio')"
            :hint="t('invoicing.numbering.field.reinicio_hint')"
            persistent-hint
          />
        </div>

        <v-divider class="my-4" />

        <div class="text-subtitle-2 mb-2">
          {{ t("invoicing.numbering.dialog.format_section") }}
        </div>

        <div class="d-flex ga-3 mb-1">
          <v-text-field
            v-model="form.formato"
            :label="t('invoicing.numbering.field.formato')"
            :error="!formatoOk"
            :error-messages="
              formatoOk ? [] : [t('invoicing.numbering.error.missing_token')]
            "
            maxlength="100"
          />
          <v-text-field
            v-model.number="form.padding"
            :label="t('invoicing.numbering.field.padding')"
            type="number"
            min="0"
            max="20"
            style="max-width: 130px"
          />
          <v-text-field
            v-model.number="form.valore_inicial"
            :label="t('invoicing.numbering.field.valore_inicial')"
            type="number"
            min="0"
            style="max-width: 150px"
          />
        </div>

        <!-- Tokens disponibles: click para insertar al final del formato. -->
        <div class="d-flex flex-wrap ga-1 mb-3">
          <v-chip
            v-for="tk in tokens"
            :key="tk.token"
            size="x-small"
            variant="outlined"
            link
            @click="appendToken(tk.token)"
          >
            {{ tk.token }} — {{ t(tk.labelKey) }}
          </v-chip>
        </div>

        <v-alert
          :type="formatoOk ? 'info' : 'warning'"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          <div class="d-flex align-center ga-2 flex-wrap">
            <span class="text-caption">{{
              t("invoicing.numbering.dialog.preview")
            }}</span>
            <code class="numbering-sample">{{ sample }}</code>
            <span
              v-if="isLegacyFormat"
              class="text-caption text-medium-emphasis"
            >
              {{ t("invoicing.numbering.dialog.legacy_note") }}
            </span>
          </div>
        </v-alert>

        <v-checkbox
          v-model="isDefault"
          :label="t('invoicing.numbering.field.is_default')"
          :hint="t('invoicing.numbering.field.is_default_hint')"
          persistent-hint
          density="compact"
        />

        <!-- El cambio de serie a mitad de periodo es lo que dispara una
             inspección fiscal: se avisa, no se bloquea. -->
        <v-alert
          v-if="isEdit && formatChanged"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{ t("invoicing.numbering.warn.format_changed") }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ t("common.cancel") }}</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!canSave"
          :loading="saving"
          @click="save"
        >
          {{ t("common.save") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  formatSample,
  formatoIsValid,
  type NumberingEngine,
  type NumberingEngineInput,
  type NumberingTipo,
  type NumberingReinicio,
} from "../../services/numbering.service";

const props = defineProps<{
  modelValue: boolean;
  /** Motor a editar; null = crear uno nuevo. */
  engine?: NumberingEngine | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [boolean];
  saved: [NumberingEngineInput & { id?: number }];
}>();

const { t } = useI18n();

const saving = ref(false);
const isEdit = computed(() => !!props.engine?.id);

const DEFAULTS = {
  codice: "",
  label: "",
  tipo_fattura: "A" as NumberingTipo,
  formato: "{n}",
  padding: 0,
  reinicio: "anual" as NumberingReinicio,
  valore_inicial: 1,
};

const form = ref({ ...DEFAULTS });
const isDefault = ref(false);
const originalFormat = ref("");

const tokens = [
  { token: "{n}", labelKey: "numbering.token.n" },
  { token: "{anno}", labelKey: "numbering.token.anno" },
  { token: "{aa}", labelKey: "numbering.token.aa" },
  { token: "{mese}", labelKey: "numbering.token.mese" },
  { token: "{serie}", labelKey: "numbering.token.serie" },
];

const tipoItems = computed(() => [
  { value: "A", title: t("invoicing.numbering.tipo.active") },
  { value: "P", title: t("invoicing.numbering.tipo.passive") },
]);

const reinicioItems = computed(() => [
  { value: "anual", title: t("invoicing.numbering.reinicio.anual") },
  { value: "mensual", title: t("invoicing.numbering.reinicio.mensual") },
  { value: "nunca", title: t("invoicing.numbering.reinicio.nunca") },
]);

const formatoOk = computed(() => formatoIsValid(form.value.formato));

/** '{n}' sin padding = entero desnudo, el comportamiento legacy. */
const isLegacyFormat = computed(
  () => form.value.formato === "{n}" && form.value.padding <= 0,
);

const sample = computed(() =>
  formatSample(
    form.value.formato,
    form.value.padding,
    form.value.valore_inicial || 1,
    form.value.tipo_fattura,
  ),
);

const formatChanged = computed(
  () =>
    isEdit.value &&
    originalFormat.value !== "" &&
    form.value.formato !== originalFormat.value,
);

const canSave = computed(
  () =>
    formatoOk.value &&
    form.value.label.trim() !== "" &&
    (isEdit.value || form.value.codice.trim() !== "") &&
    form.value.padding >= 0 &&
    form.value.padding <= 20,
);

function appendToken(token: string): void {
  form.value.formato = `${form.value.formato}${token}`;
}

function close(): void {
  emit("update:modelValue", false);
}

function save(): void {
  if (!canSave.value) return;
  saving.value = true;
  const payload: NumberingEngineInput & { id?: number } = {
    label: form.value.label.trim(),
    tipo_fattura: form.value.tipo_fattura,
    formato: form.value.formato.trim(),
    padding: Number(form.value.padding) || 0,
    reinicio: form.value.reinicio,
    valore_inicial: Number(form.value.valore_inicial) || 1,
    is_default: isDefault.value ? "S" : "N",
  };
  // El codice es la identidad del motor: solo se envía al crear.
  if (isEdit.value) payload.id = props.engine!.id;
  else payload.codice = form.value.codice.trim();

  emit("saved", payload);
  saving.value = false;
}

// Reset al ABRIR (no al cerrar): el patrón de los demás diálogos de la app.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    if (props.engine) {
      form.value = {
        codice: props.engine.codice,
        label: props.engine.label,
        tipo_fattura: props.engine.tipo_fattura,
        formato: props.engine.formato,
        padding: Number(props.engine.padding) || 0,
        reinicio: props.engine.reinicio,
        valore_inicial: Number(props.engine.valore_inicial) || 1,
      };
      isDefault.value = props.engine.is_default === "S";
      originalFormat.value = props.engine.formato;
    } else {
      form.value = { ...DEFAULTS };
      isDefault.value = false;
      originalFormat.value = "";
    }
  },
);
</script>

<style scoped>
.numbering-sample {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}
</style>
