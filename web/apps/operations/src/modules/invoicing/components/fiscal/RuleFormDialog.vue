<template>
  <v-dialog
    :model-value="modelValue"
    max-width="760"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1">
        {{
          t("invoicing.fiscal.form.new_title", {
            tabla: t(`invoicing.fiscal.tabla.${tabla}`),
          })
        }}
      </v-card-title>
      <v-card-text>
        <v-alert
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3 text-body-2"
        >
          {{ t("invoicing.fiscal.form.new_intro") }}
        </v-alert>
        <div class="fisc-form-grid">
          <div
            v-for="field in visibleFields"
            :key="field.key"
            :class="{ 'fisc-form-wide': field.type === 'textarea' }"
          >
            <FiscFieldInput
              v-model="form[field.key]"
              :field="field"
              :tabla="tabla"
              :error="errors[field.key]"
            />
          </div>
        </div>
        <!-- Condición: atajo simple (campo de texto) o constructor visual (JSON) -->
        <div v-if="supportsBuilder" class="mt-2">
          <v-switch
            v-model="useBuilder"
            :label="t('invoicing.fiscal.cond.use_builder')"
            :hint="t('invoicing.fiscal.cond.use_builder_hint')"
            persistent-hint
            density="compact"
            color="primary"
          />
          <ConditionBuilder
            v-if="useBuilder"
            v-model="condJson"
            :stage="ruleStage"
            @update:valid="condValid = $event"
          />
          <div
            v-if="errors.condicion_json"
            class="text-caption text-error mt-1"
            role="alert"
          >
            {{ errors.condicion_json }}
          </div>
        </div>
        <v-text-field
          v-model="motivo"
          class="mt-2"
          :label="t('invoicing.fiscal.motivo') + ' *'"
          :hint="t('invoicing.fiscal.motivo_hint')"
          persistent-hint
          :error-messages="errors.motivo ? [errors.motivo] : []"
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
          color="primary"
          variant="flat"
          :loading="busy"
          :disabled="!motivo.trim() || (useBuilder && !condValid)"
          @click="save"
        >
          {{ t("common.create") }}
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
  type FiscTabla,
} from "../../services/fiscConfig.service";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";
import ConditionBuilder from "./ConditionBuilder.vue";
import FiscFieldInput from "./FiscFieldInput.vue";
import { stageOfRule } from "./conditionModel";
import { TABLE_FIELDS } from "./fiscFields";

const props = defineProps<{
  modelValue: boolean;
  tabla: FiscTabla;
  /** Valores iniciales (p. ej. el concepto o el país del filtro). */
  initial?: Record<string, string | number | null>;
  today: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved", id: number | string): void;
}>();

const { t } = useI18n();
const fields = computed(() => TABLE_FIELDS[props.tabla]);
const form = reactive<Record<string, string | number | null>>({});
const errors = ref<Record<string, string>>({});
const errorMessage = ref("");
const motivo = ref("");
const busy = ref(false);

// Condición con el constructor visual (solo valori y requisiti: son las tablas
// con `condicion_json`). Con el constructor activo manda el JSON y el campo de
// texto `condicion` se oculta; sin filas se guarda la condición simple.
const store = useFiscConfigStore();
const useBuilder = ref(false);
const condJson = ref<string | null>(null);
const condValid = ref(true);
const supportsBuilder = computed(
  () => props.tabla === "valori" || props.tabla === "requisiti",
);
const visibleFields = computed(() =>
  useBuilder.value
    ? fields.value.filter((f) => f.key !== "condicion")
    : fields.value,
);
const ruleStage = computed(() => {
  const voce = store.meta?.voci.find((v) => v.id === Number(form.id_voce));
  return stageOfRule(props.tabla, voce);
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    for (const k of Object.keys(form)) delete form[k];
    for (const f of fields.value) {
      form[f.key] = f.type === "sn" ? "S" : "";
    }
    if (fields.value.some((f) => f.key === "condicion")) {
      form.condicion = "SIEMPRE";
    }
    form.data_inizio = props.today;
    Object.assign(form, props.initial ?? {});
    errors.value = {};
    errorMessage.value = "";
    motivo.value = "";
    useBuilder.value = false;
    condJson.value = null;
    condValid.value = true;
  },
);

async function save(): Promise<void> {
  busy.value = true;
  errors.value = {};
  errorMessage.value = "";
  try {
    const data: Record<string, unknown> = {};
    const withJson = useBuilder.value && condJson.value !== null;
    for (const f of fields.value) {
      if (withJson && f.key === "condicion") continue;
      const v = form[f.key];
      if (v === null || v === undefined) continue;
      if (v === "" && !f.allowEmpty && f.type !== "regex") continue;
      data[f.key] = v;
    }
    if (withJson) data.condicion_json = condJson.value;
    const res = await fiscConfigService.create(props.tabla, data, motivo.value);
    emit("saved", res.id);
    emit("update:modelValue", false);
  } catch (e) {
    errors.value = fieldErrors(e);
    errorMessage.value = toUserMessage(e, String(e));
  } finally {
    busy.value = false;
  }
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
</style>
