<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card v-if="row">
      <v-card-title class="text-subtitle-1 d-flex align-center ga-2">
        <v-icon
          :icon="
            current === 'close' ? 'mdi-calendar-end' : 'mdi-delete-outline'
          "
          :color="current === 'close' ? 'primary' : 'error'"
        />
        {{ t(`invoicing.fiscal.end.${current}_title`) }}
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-2">
          {{ t(`invoicing.fiscal.end.${current}_intro`) }}
        </p>
        <div class="text-body-2 mb-3">
          <strong>#{{ key }}</strong>
          · {{ row.data_inizio }} →
          {{ row.data_fine ?? t("invoicing.fiscal.open") }}
        </div>

        <v-progress-linear v-if="loading" indeterminate class="mb-2" />
        <v-alert
          v-else-if="detail && detail.aplicada"
          :type="current === 'deactivate' ? 'error' : 'info'"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{
            detail.ultima_aplicacion
              ? t("invoicing.fiscal.end.applied_until", {
                  fecha: detail.ultima_aplicacion,
                })
              : t("invoicing.fiscal.end.applied")
          }}
          <div v-if="current === 'deactivate'" class="mt-2">
            <v-btn size="small" variant="tonal" @click="current = 'close'">
              {{ t("invoicing.fiscal.actions.close") }}
            </v-btn>
          </div>
        </v-alert>

        <v-text-field
          v-if="current === 'close'"
          v-model="dataFine"
          type="date"
          :label="t('invoicing.fiscal.field.data_fine') + ' *'"
          density="compact"
        />
        <v-text-field
          v-model="motivo"
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
          :color="current === 'close' ? 'primary' : 'error'"
          variant="flat"
          :loading="busy"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ t(`invoicing.fiscal.actions.${current}`) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fiscConfigService,
  type FiscRow,
  type FiscTabla,
} from "../../services/fiscConfig.service";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";
import { rowKey } from "./fiscFields";

const props = defineProps<{
  modelValue: boolean;
  tabla: FiscTabla;
  row: FiscRow | null;
  mode: "close" | "deactivate";
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "saved"): void;
}>();

const { t } = useI18n();
const store = useFiscConfigStore();

const current = ref<"close" | "deactivate">("close");
const detail = ref<FiscRow | null>(null);
const loading = ref(false);
const busy = ref(false);
const dataFine = ref("");
const motivo = ref("");
const errorMessage = ref("");

const key = computed(() => (props.row ? rowKey(props.tabla, props.row) : ""));

const canSubmit = computed(() => {
  if (!motivo.value.trim()) return false;
  if (current.value === "close") return !!dataFine.value;
  return !(detail.value && detail.value.aplicada);
});

watch(
  () => [props.modelValue, props.row] as const,
  async ([open, row]) => {
    if (!open || !row) return;
    current.value = props.mode;
    dataFine.value = store.hoy;
    motivo.value = "";
    errorMessage.value = "";
    detail.value = null;
    loading.value = true;
    try {
      detail.value = await fiscConfigService.row(
        props.tabla,
        rowKey(props.tabla, row),
      );
    } catch (e) {
      errorMessage.value = toUserMessage(e, String(e));
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

async function submit(): Promise<void> {
  if (!props.row) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    if (current.value === "close") {
      await fiscConfigService.close(
        props.tabla,
        key.value,
        dataFine.value,
        motivo.value,
      );
    } else {
      await fiscConfigService.deactivate(props.tabla, key.value, motivo.value);
    }
    emit("saved");
    emit("update:modelValue", false);
  } catch (e) {
    errorMessage.value = toUserMessage(e, String(e));
  } finally {
    busy.value = false;
  }
}
</script>
