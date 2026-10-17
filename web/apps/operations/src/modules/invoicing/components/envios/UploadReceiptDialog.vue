<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-subtitle-1">
        {{ t("invoicing.envios.upload.title") }}
      </v-card-title>
      <v-card-text>
        <p v-if="row" class="text-body-2 mb-3">
          {{
            t("invoicing.envios.upload.intro", {
              numero: numeroOf(row),
              canal: row.canal_tipo ?? "",
            })
          }}
        </p>
        <v-file-input
          v-model="files"
          :label="t('invoicing.envios.upload.file')"
          accept=".xml,.p7m,.eml,.txt,.msg"
          density="comfortable"
          prepend-icon="mdi-paperclip"
          show-size
          :hint="t('invoicing.envios.upload.hint')"
          persistent-hint
        />
        <v-select
          v-if="row?.canal_tipo === 'EMAIL'"
          v-model="resultado"
          class="mt-3"
          :items="resultadoItems"
          item-title="label"
          item-value="value"
          :label="t('invoicing.envios.upload.declared')"
          :hint="t('invoicing.envios.upload.declared_hint')"
          persistent-hint
          clearable
          density="comfortable"
        />
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
          :disabled="!file"
          @click="submit"
        >
          {{ t("invoicing.envios.actions.upload_receipt") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { fileToBase64, type EnvioRow } from "../../services/envios.service";

const props = defineProps<{
  modelValue: boolean;
  row: EnvioRow | null;
  busy?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (
    e: "submit",
    payload: {
      id: number;
      filename: string;
      contentBase64: string;
      resultado?: "ACEPTADA" | "RECHAZADA";
    },
  ): void;
}>();

const { t } = useI18n();
const files = ref<File[] | File | null>(null);
const resultado = ref<"ACEPTADA" | "RECHAZADA" | null>(null);

const file = computed<File | null>(() => {
  const f = files.value;
  if (!f) return null;
  return Array.isArray(f) ? (f[0] ?? null) : f;
});

const resultadoItems = computed(() => [
  { value: "ACEPTADA", label: t("invoicing.envios.estado.ACEPTADA") },
  { value: "RECHAZADA", label: t("invoicing.envios.estado.RECHAZADA") },
]);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      files.value = null;
      resultado.value = null;
    }
  },
);

function numeroOf(r: EnvioRow): string {
  return String(r.numero_alfanum || r.numero);
}

async function submit(): Promise<void> {
  if (!props.row || !file.value) return;
  const contentBase64 = await fileToBase64(file.value);
  emit("submit", {
    id: props.row.id,
    filename: file.value.name,
    contentBase64,
    resultado: resultado.value ?? undefined,
  });
}
</script>
